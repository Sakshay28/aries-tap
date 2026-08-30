// The numbers behind the owner Overview, as pure functions over raw rows. Kept
// side-effect free so the JSON fallback and the unit tests compute them exactly
// the way Postgres does — and so a metric can never silently diverge between the
// two data planes. The Neon path in db.ts aggregates the same definitions in SQL
// for volume; this is the reference implementation.

import type {
  OverviewMetrics,
  SeriesPoint,
  TagStat,
  TapEvent,
  TapEventType,
} from "./types";

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function startOfUtcDay(d = new Date()): number {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c.getTime();
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function count(events: TapEvent[], type: TapEventType): number {
  let n = 0;
  for (const e of events) if (e.type === type) n++;
  return n;
}

function countToday(events: TapEvent[], type: TapEventType, dayStart: number): number {
  let n = 0;
  for (const e of events) {
    if (e.type === type && new Date(e.createdAt).getTime() >= dayStart) n++;
  }
  return n;
}

// A "review" for the headline number is a distinct session that produced a
// captured rating (REVIEW_RECEIVED) or a private submission (REVIEW_SUBMITTED).
// Counting sessions — not raw events — means indecisive re-taps of the stars
// never inflate the figure.
function reviewSessions(events: TapEvent[]): Set<string> {
  const s = new Set<string>();
  for (const e of events) {
    if ((e.type === "REVIEW_RECEIVED" || e.type === "REVIEW_SUBMITTED") && e.sessionId) {
      s.add(e.sessionId);
    }
  }
  return s;
}

// Average rating over the last captured rating per session, so a guest who taps
// 3★ then settles on 5★ counts once, at 5. Mirrors the review feature's own
// "last rating per session" rule.
function averageRating(events: TapEvent[]): number {
  const last = new Map<string, number>();
  for (const e of events) {
    if (e.type === "REVIEW_RECEIVED" && typeof e.rating === "number" && e.rating >= 1) {
      last.set(e.sessionId, e.rating);
    }
  }
  if (last.size === 0) return 0;
  let sum = 0;
  for (const r of last.values()) sum += r;
  return round(sum / last.size, 2);
}

function taps14d(events: TapEvent[]): SeriesPoint[] {
  const today = startOfUtcDay();
  const buckets: SeriesPoint[] = [];
  const index = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const ms = today - i * 864e5;
    const key = dayKey(ms);
    index.set(key, buckets.length);
    buckets.push({ date: key, count: 0 });
  }
  for (const e of events) {
    if (e.type !== "NFC_TAP") continue;
    const key = dayKey(new Date(e.createdAt).getTime());
    const i = index.get(key);
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

// Per-tag NFC tap stats, folded from events and joined to the tag registry so a
// tag with zero taps still appears (and a tap for an unknown/archived code is
// tolerated rather than dropped).
export type TagInfo = { code: string; label: string; isActive: boolean };

function topTags(events: TapEvent[], tags: TagInfo[], dayStart: number): TagStat[] {
  const stat = new Map<string, TagStat>();
  const ensure = (code: string, info?: TagInfo): TagStat => {
    let s = stat.get(code);
    if (!s) {
      s = {
        code,
        label: info?.label ?? "",
        isActive: info?.isActive ?? false,
        taps: 0,
        tapsToday: 0,
        lastActivity: null,
      };
      stat.set(code, s);
    }
    return s;
  };
  for (const t of tags) ensure(t.code, t);
  for (const e of events) {
    if (e.type !== "NFC_TAP" || !e.tagCode) continue;
    const s = ensure(e.tagCode);
    s.taps++;
    const t = new Date(e.createdAt).getTime();
    if (t >= dayStart) s.tapsToday++;
    if (!s.lastActivity || e.createdAt > s.lastActivity) s.lastActivity = e.createdAt;
  }
  return [...stat.values()]
    .sort((a, b) => b.taps - a.taps || (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
    // Every table, not just a leaderboard — the simple dashboard's Taps card
    // breaks the total down per table, so all of a venue's tags must be present.
    .slice(0, 500);
}

export function computeOverview(
  events: TapEvent[],
  tags: TagInfo[],
  now = new Date()
): OverviewMetrics {
  const dayStart = startOfUtcDay(now);

  const totalTaps = count(events, "NFC_TAP");
  const whatsappClicks = count(events, "WHATSAPP_CLICK");
  const reviews = reviewSessions(events).size;
  const activeTags = tags.filter((t) => t.isActive).length;

  // Conversion: of the sessions that tapped a tag, how many went on to click
  // WhatsApp. Session-scoped so it reads as a real per-visit rate, not a
  // ratio of two unrelated totals.
  const tapSessions = new Set<string>();
  const waSessions = new Set<string>();
  for (const e of events) {
    if (e.type === "NFC_TAP" && e.sessionId) tapSessions.add(e.sessionId);
    if (e.type === "WHATSAPP_CLICK" && e.sessionId) waSessions.add(e.sessionId);
  }
  let converted = 0;
  for (const s of waSessions) if (tapSessions.has(s)) converted++;
  const conversionRate = tapSessions.size ? round((converted / tapSessions.size) * 100) : 0;

  return {
    totalTaps,
    tapsToday: countToday(events, "NFC_TAP", dayStart),
    whatsappClicks,
    whatsappClicksToday: countToday(events, "WHATSAPP_CLICK", dayStart),
    reviews,
    averageRating: averageRating(events),
    profileViews: count(events, "PROFILE_VIEW"),
    conversionRate,
    activeTags,
    totalEvents: events.length,
    taps14d: taps14d(events),
    topTags: topTags(events, tags, dayStart),
    generatedAt: now.toISOString(),
  };
}

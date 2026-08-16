// The numbers behind the dashboard. One pure function turns the raw event +
// feedback rows into every card and chart, so the funnel is computed identically
// whether the data came from Neon or the JSON fallback. Pure and side-effect
// free — trivially unit-testable.

import { reviewSettings } from "./config";
import type { AiCategory, EventRow, FeedbackRow, Rating } from "./types";

export type FunnelStage = { key: string; label: string; count: number };

export type DayPoint = { date: string; count: number; avg: number };

export type Analytics = {
  funnel: FunnelStage[];
  totalRatings: number;
  averageRating: number;
  ratingCounts: Record<Rating, number>;
  positivePct: number;
  negativePct: number;
  googleCtr: number; // google clicks ÷ google-eligible ratings
  avgTimeMs: number; // mean time-in-modal across completed/abandoned sessions
  repeatVisitorPct: number;
  sessions: number;
  daily: DayPoint[]; // last 14 days of rating activity
  weekly: DayPoint[]; // last 8 weeks
  categoryCounts: Record<AiCategory, number>;
  openCount: number; // unresolved private feedback
};

function uniqueSessions(rows: { sessionId: string }[]): number {
  return new Set(rows.map((r) => r.sessionId)).size;
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD (already UTC ISO)
}

export function computeAnalytics(
  events: EventRow[],
  feedback: FeedbackRow[]
): Analytics {
  const { googleThreshold } = reviewSettings();

  const opened = events.filter((e) => e.name === "opened");
  const rated = events.filter((e) => e.name === "rating_selected");
  const googleClicks = events.filter((e) => e.name === "google_clicked");
  const submitted = events.filter((e) => e.name === "feedback_submitted");

  // —— funnel (unique sessions per stage) ——
  const completedSessions = new Set<string>();
  for (const e of [...googleClicks, ...submitted]) completedSessions.add(e.sessionId);

  const funnel: FunnelStage[] = [
    { key: "opened", label: "Review opened", count: uniqueSessions(opened) },
    { key: "rated", label: "Rating selected", count: uniqueSessions(rated) },
    { key: "google", label: "Sent to Google", count: uniqueSessions(googleClicks) },
    { key: "private", label: "Private feedback", count: uniqueSessions(submitted) },
    { key: "completed", label: "Completed", count: completedSessions.size },
  ];

  // —— rating distribution (from the true rating signal, not just complaints) ——
  // A happy guest never creates a feedback row, so ratings live in the events.
  // We take the last rating per session to avoid double-counting indecision.
  const lastRatingBySession = new Map<string, number>();
  for (const e of rated) {
    if (typeof e.rating === "number") lastRatingBySession.set(e.sessionId, e.rating);
  }
  const ratingCounts: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  for (const r of lastRatingBySession.values()) {
    if (r >= 1 && r <= 5) {
      ratingCounts[r as Rating]++;
      ratingSum += r;
    }
  }
  const totalRatings = lastRatingBySession.size;
  const averageRating = totalRatings ? round(ratingSum / totalRatings, 2) : 0;

  const positive = Object.entries(ratingCounts)
    .filter(([r]) => Number(r) >= googleThreshold)
    .reduce((a, [, n]) => a + n, 0);
  const positivePct = totalRatings ? round((positive / totalRatings) * 100) : 0;
  const negativePct = totalRatings ? round(100 - positivePct) : 0;

  // —— Google CTR: of the guests eligible for the public invite, how many went ——
  const eligible = Object.entries(ratingCounts)
    .filter(([r]) => Number(r) >= googleThreshold)
    .reduce((a, [, n]) => a + n, 0);
  const googleCtr = eligible
    ? round((uniqueSessions(googleClicks) / eligible) * 100)
    : 0;

  // —— average time in modal — from event meta.timeMs on terminal events ——
  const times: number[] = [];
  for (const e of events) {
    const t = e.meta?.timeMs;
    if (typeof t === "number" && t > 0 && t < 1000 * 60 * 30) times.push(t);
  }
  const avgTimeMs = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;

  // —— repeat visitors — via the opaque per-device token on `opened` events ——
  const opensByVisitor = new Map<string, number>();
  for (const e of opened) {
    const v = e.meta?.visitor;
    if (typeof v === "string" && v) {
      opensByVisitor.set(v, (opensByVisitor.get(v) ?? 0) + 1);
    }
  }
  const visitors = opensByVisitor.size;
  const repeats = [...opensByVisitor.values()].filter((n) => n > 1).length;
  const repeatVisitorPct = visitors ? round((repeats / visitors) * 100) : 0;

  // —— daily (14d) + weekly (8w) rating activity ——
  const daily = buildSeries(rated, 14, "day");
  const weekly = buildSeries(rated, 8, "week");

  // —— private-feedback category mix (from AI/heuristic tags) ——
  const categoryCounts: Record<AiCategory, number> = {
    food: 0,
    service: 0,
    ambience: 0,
    cleanliness: 0,
    pricing: 0,
    staff: 0,
    other: 0,
  };
  for (const f of feedback) {
    for (const c of f.ai?.categories ?? []) categoryCounts[c]++;
  }

  const openCount = feedback.filter(
    (f) => f.status === "open" || f.status === "in_progress"
  ).length;

  return {
    funnel,
    totalRatings,
    averageRating,
    ratingCounts,
    positivePct,
    negativePct,
    googleCtr,
    avgTimeMs,
    repeatVisitorPct,
    sessions: uniqueSessions(opened),
    daily,
    weekly,
    categoryCounts,
    openCount,
  };
}

// Bucket rating events into the last N day/week slots, newest last, filling
// empty slots with zeros so the chart never has gaps.
function buildSeries(
  rated: EventRow[],
  slots: number,
  unit: "day" | "week"
): DayPoint[] {
  const now = new Date();
  const buckets: { start: Date; label: string }[] = [];
  for (let i = slots - 1; i >= 0; i--) {
    const d = new Date(now);
    if (unit === "day") {
      d.setUTCDate(d.getUTCDate() - i);
      buckets.push({ start: startOfDay(d), label: dayKey(d.toISOString()) });
    } else {
      d.setUTCDate(d.getUTCDate() - i * 7);
      buckets.push({ start: startOfDay(d), label: dayKey(d.toISOString()) });
    }
  }
  const spanMs = (unit === "day" ? 1 : 7) * 24 * 60 * 60 * 1000;

  return buckets.map((b) => {
    const from = b.start.getTime();
    const to = from + spanMs;
    let count = 0;
    let sum = 0;
    for (const e of rated) {
      const t = new Date(e.createdAt).getTime();
      if (t >= from && t < to && typeof e.rating === "number") {
        count++;
        sum += e.rating;
      }
    }
    return { date: b.label, count, avg: count ? round(sum / count, 2) : 0 };
  });
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

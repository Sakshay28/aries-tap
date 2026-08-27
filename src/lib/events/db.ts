// Durable store for the unified event stream. Same two-track design as every
// other feature in this repo: Neon Postgres when DATABASE_URL is set (lazily
// imported so a build never requires it), and a JSON-file fallback so the whole
// dashboard — live feed included — runs locally with nothing configured.
//
// One table, `tap_events`, is the single source of truth the owner dashboard
// reads and the realtime stream replays. Indexes are chosen for the exact
// queries below: the tenant activity feed, the per-type/per-tag counts, and the
// idempotent write.
//
// Every function takes an explicit `tenantId`. The data model was always
// tenant-shaped; making the tenant a required argument (rather than a build-time
// constant) is what makes the store genuinely multi-tenant — the same running
// process and the same table serve many businesses, and a query is physically
// incapable of returning another tenant's rows. The caller resolves the tenant
// authoritatively (from the tag's owner on writes, from the signed owner session
// on reads) and passes it here; this layer never trusts a client for it.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ACTIVITY_MAX_PAGE_SIZE, RESYNC_MAX_EVENTS } from "./config";
import { computeOverview, type TagInfo } from "./analytics";
import {
  decodeCursor,
  type NewTapEvent,
  type OverviewMetrics,
  type TapEvent,
  type TapEventMeta,
  type TapEventType,
} from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
export const usingRealDb = Boolean(DATABASE_URL);

// Guard against a production deployment silently running on the JSON fallback:
// that store is per-instance and ephemeral (os.tmpdir), so it would lose events,
// break multi-instance dashboards, and never match the durability the dashboard
// promises. Fail closed instead. `ARIES_DATA_DIR` is the explicit opt-in a test
// or a deliberately file-backed self-host sets, so its presence allows the
// fallback even under NODE_ENV=production. Only reached at request time (these
// functions aren't called during `next build`), so the build stays green.
function assertDurablePersistence(): void {
  if (!usingRealDb && process.env.NODE_ENV === "production" && !process.env.ARIES_DATA_DIR) {
    throw new Error(
      "No DATABASE_URL in production: refusing the ephemeral, per-instance JSON " +
        "event store. Set DATABASE_URL for durable persistence, or ARIES_DATA_DIR " +
        "to opt into a file store explicitly."
    );
  }
}

// —————————————————————————————— Neon Postgres

let ensured = false;

async function sql() {
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(DATABASE_URL!);
  if (!ensured) {
    await q`
      CREATE TABLE IF NOT EXISTS tap_events (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        text NOT NULL,
        type             text NOT NULL,
        tag_code         text,
        session_id       text NOT NULL DEFAULT '',
        visitor_id       text NOT NULL DEFAULT '',
        rating           int,
        meta             jsonb NOT NULL DEFAULT '{}',
        source           text NOT NULL DEFAULT 'server',
        device           text NOT NULL DEFAULT '',
        browser          text NOT NULL DEFAULT '',
        os               text NOT NULL DEFAULT '',
        country          text NOT NULL DEFAULT '',
        city             text NOT NULL DEFAULT '',
        idempotency_key  text,
        created_at       timestamptz NOT NULL DEFAULT now()
      )`;
    // The activity feed + SSE resync: newest-first within a tenant, total
    // ordered by (created_at, id) so pagination never skips or repeats a row.
    await q`CREATE INDEX IF NOT EXISTS tap_events_tenant_time_idx
            ON tap_events (tenant_id, created_at DESC, id DESC)`;
    // Overview counts filter by type; per-tag stats group by tag. Both are the
    // spec's (tenant_id + type + created_at) and (tenant_id + tag + created_at)
    // access patterns, so no dashboard query ever scans the whole table.
    await q`CREATE INDEX IF NOT EXISTS tap_events_type_idx
            ON tap_events (tenant_id, type, created_at DESC)`;
    await q`CREATE INDEX IF NOT EXISTS tap_events_tag_idx
            ON tap_events (tenant_id, tag_code, created_at DESC)`;
    // Idempotency: a non-empty key is unique per tenant, so a retried write or a
    // double-tapped CTA collapses to one row (see ingest.ts for how keys are
    // minted with a time bucket to get windowed dedupe). Per-tenant so two
    // businesses can never collide on a key.
    await q`CREATE UNIQUE INDEX IF NOT EXISTS tap_events_idem_idx
            ON tap_events (tenant_id, idempotency_key)
            WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''`;
    ensured = true;
  }
  return q;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

// —————————————————————————————— JSON fallback

// `ARIES_DATA_DIR` lets a test point the fallback store at a throwaway directory
// (and is a convenient override for a self-hosted deployment). Otherwise: a
// writable tmp dir in production, the repo's .data locally.
const DIR =
  process.env.ARIES_DATA_DIR ||
  (process.env.NODE_ENV === "production"
    ? os.tmpdir()
    : path.join(process.cwd(), ".data"));
const EVENTS_FILE = path.join(DIR, "tap_events.json");
// The fallback is dev-only and single-process; keep it bounded, not archival.
const FALLBACK_CAP = 10000;

async function readJson<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

async function writeJson<T>(file: string, rows: T[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2));
}

// Serialize read-modify-write so a burst of taps in dev can't lose a row.
let jsonLock: Promise<unknown> = Promise.resolve();
function withJsonLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = jsonLock.then(fn, fn);
  jsonLock = next.catch(() => {});
  return next;
}

// —————————————————————————————— row mapping (Neon → app)

function mapEvent(r: Record<string, unknown>): TapEvent {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    type: String(r.type) as TapEventType,
    tagCode: r.tag_code == null ? null : String(r.tag_code),
    sessionId: String(r.session_id ?? ""),
    visitorId: r.visitor_id ? String(r.visitor_id) : null,
    rating: r.rating == null ? null : Number(r.rating),
    meta: (r.meta as TapEventMeta) ?? {},
    source: String(r.source ?? "server") as TapEvent["source"],
    device: String(r.device ?? ""),
    browser: String(r.browser ?? ""),
    os: String(r.os ?? ""),
    country: String(r.country ?? ""),
    city: String(r.city ?? ""),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// —————————————————————————————— writes

// Insert one event for `tenantId`, honoring the idempotency key. Returns the
// stored row and whether it was a fresh insert (so the caller only publishes
// real news to the realtime bus, never a deduped retry). Concurrency-safe with
// no application lock: the unique index turns a racing duplicate into a caught
// 23505 that resolves to the already-stored row (spec §14).
export async function insertTapEvent(
  tenantId: string,
  input: NewTapEvent & {
    device: string;
    browser: string;
    os: string;
    country: string;
    city: string;
  }
): Promise<{ event: TapEvent; created: boolean }> {
  assertDurablePersistence();
  const key = input.idempotencyKey?.trim() || null;

  if (usingRealDb) {
    const q = await sql();
    try {
      const rows = (await q`
        INSERT INTO tap_events
          (tenant_id, type, tag_code, session_id, visitor_id, rating, meta,
           source, device, browser, os, country, city, idempotency_key)
        VALUES
          (${tenantId}, ${input.type}, ${input.tagCode}, ${input.sessionId},
           ${input.visitorId ?? ""}, ${input.rating ?? null},
           ${JSON.stringify(input.meta ?? {})}, ${input.source}, ${input.device},
           ${input.browser}, ${input.os}, ${input.country}, ${input.city}, ${key})
        RETURNING *`) as Record<string, unknown>[];
      return { event: mapEvent(rows[0]), created: true };
    } catch (err) {
      if (key && isUniqueViolation(err)) {
        const rows = (await q`
          SELECT * FROM tap_events
          WHERE tenant_id = ${tenantId} AND idempotency_key = ${key}
          LIMIT 1`) as Record<string, unknown>[];
        if (rows[0]) return { event: mapEvent(rows[0]), created: false };
      }
      throw err;
    }
  }

  return withJsonLock(async () => {
    const rows = await readJson<TapEvent & { idempotencyKey?: string | null }>(EVENTS_FILE);
    if (key) {
      const dup = rows.find((r) => r.tenantId === tenantId && r.idempotencyKey === key);
      if (dup) return { event: stripKey(dup), created: false };
    }
    const event: TapEvent = {
      id: crypto.randomUUID(),
      tenantId,
      type: input.type,
      tagCode: input.tagCode,
      sessionId: input.sessionId,
      visitorId: input.visitorId ?? null,
      rating: input.rating ?? null,
      meta: input.meta ?? {},
      source: input.source,
      device: input.device,
      browser: input.browser,
      os: input.os,
      country: input.country,
      city: input.city,
      createdAt: new Date().toISOString(),
    };
    rows.unshift({ ...event, idempotencyKey: key });
    await writeJson(EVENTS_FILE, rows.slice(0, FALLBACK_CAP));
    return { event, created: true };
  });
}

function stripKey(r: TapEvent & { idempotencyKey?: string | null }): TapEvent {
  const { idempotencyKey: _drop, ...rest } = r;
  void _drop;
  return rest;
}

// —————————————————————————————— reads: activity feed

export async function listActivity(
  tenantId: string,
  opts: {
    cursor?: string | null;
    limit?: number;
    types?: TapEventType[];
  }
): Promise<{ events: TapEvent[]; nextCursor: string | null }> {
  assertDurablePersistence();
  const limit = Math.min(Math.max(1, opts.limit ?? 40), ACTIVITY_MAX_PAGE_SIZE);
  const cur = decodeCursor(opts.cursor);
  const typeFilter = opts.types && opts.types.length ? opts.types : null;

  if (usingRealDb) {
    const q = await sql();
    // Fetch one extra to know whether another page exists.
    const rows = (cur
      ? await q`
          SELECT * FROM tap_events
          WHERE tenant_id = ${tenantId}
            AND (created_at < ${cur.createdAt}
                 OR (created_at = ${cur.createdAt} AND id < ${cur.id}))
            AND (${typeFilter}::text[] IS NULL OR type = ANY(${typeFilter}))
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit + 1}`
      : await q`
          SELECT * FROM tap_events
          WHERE tenant_id = ${tenantId}
            AND (${typeFilter}::text[] IS NULL OR type = ANY(${typeFilter}))
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit + 1}`) as Record<string, unknown>[];
    return page(rows.map(mapEvent), limit);
  }

  const all = (await readJson<TapEvent>(EVENTS_FILE)).filter(
    (r) => r.tenantId === tenantId && (!typeFilter || typeFilter.includes(r.type))
  );
  all.sort((a, b) => cmpDesc(a, b));
  const startFrom = cur
    ? all.filter((r) => cmpCursorDesc(r, cur) < 0)
    : all;
  return page(startFrom.slice(0, limit + 1), limit);
}

function page(rows: TapEvent[], limit: number) {
  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const last = events[events.length - 1];
  return {
    events,
    nextCursor: hasMore && last ? `${last.createdAt}|${last.id}` : null,
  };
}

function cmpDesc(a: TapEvent, b: TapEvent): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// <0 when `r` sorts strictly after the cursor in DESC order (i.e. is older).
function cmpCursorDesc(r: TapEvent, cur: { createdAt: string; id: string }): number {
  if (r.createdAt !== cur.createdAt) return r.createdAt < cur.createdAt ? -1 : 1;
  return r.id < cur.id ? -1 : r.id > cur.id ? 1 : 0;
}

// —————————————————————————————— reads: resync (ascending, newer than cursor)

// The dashboard hands its last-seen cursor on (re)connect; this returns
// everything it missed for `tenantId`, oldest-first, capped so a long absence
// can't pull the whole table. The DB — not the socket — is the source of truth.
export async function eventsSince(tenantId: string, cursor: string | null): Promise<TapEvent[]> {
  assertDurablePersistence();
  const cur = decodeCursor(cursor);

  if (usingRealDb) {
    const q = await sql();
    const rows = (cur
      ? await q`
          SELECT * FROM tap_events
          WHERE tenant_id = ${tenantId}
            AND (created_at > ${cur.createdAt}
                 OR (created_at = ${cur.createdAt} AND id > ${cur.id}))
          ORDER BY created_at ASC, id ASC
          LIMIT ${RESYNC_MAX_EVENTS}`
      : await q`
          SELECT * FROM tap_events
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC, id DESC
          LIMIT ${RESYNC_MAX_EVENTS}`) as Record<string, unknown>[];
    const mapped = rows.map(mapEvent);
    return cur ? mapped : mapped.reverse();
  }

  const all = (await readJson<TapEvent>(EVENTS_FILE)).filter((r) => r.tenantId === tenantId);
  all.sort((a, b) => -cmpDesc(a, b)); // ascending
  const newer = cur ? all.filter((r) => cmpCursorDesc(r, cur) > 0) : all;
  return cur ? newer.slice(0, RESYNC_MAX_EVENTS) : newer.slice(-RESYNC_MAX_EVENTS);
}

// —————————————————————————————— reads: overview metrics

// Real DB → aggregate server-side (the spec's requirement, and the only sane
// path at volume). Fallback → fold the raw rows with the same definitions in
// analytics.ts. `tags` comes from the QR/NFC registry (qr_codes), joined by the
// caller so this module stays about events only.
export async function overviewMetrics(tenantId: string, tags: TagInfo[]): Promise<OverviewMetrics> {
  assertDurablePersistence();
  if (!usingRealDb) {
    const all = (await readJson<TapEvent>(EVENTS_FILE)).filter((r) => r.tenantId === tenantId);
    return computeOverview(all, tags);
  }

  const q = await sql();
  const now = new Date();

  const scalarRows = (await q`
    SELECT
      count(*) FILTER (WHERE type = 'NFC_TAP')::int AS total_taps,
      count(*) FILTER (WHERE type = 'NFC_TAP' AND created_at >= date_trunc('day', now()))::int AS taps_today,
      count(*) FILTER (WHERE type = 'WHATSAPP_CLICK')::int AS wa_clicks,
      count(*) FILTER (WHERE type = 'WHATSAPP_CLICK' AND created_at >= date_trunc('day', now()))::int AS wa_today,
      count(*) FILTER (WHERE type = 'PROFILE_VIEW')::int AS profile_views,
      count(*)::int AS total_events,
      count(DISTINCT session_id) FILTER (WHERE type IN ('REVIEW_RECEIVED','REVIEW_SUBMITTED') AND session_id <> '')::int AS review_sessions,
      count(DISTINCT session_id) FILTER (WHERE type = 'NFC_TAP' AND session_id <> '')::int AS tap_sessions
    FROM tap_events
    WHERE tenant_id = ${tenantId}`) as Record<string, number>[];
  const s = scalarRows[0] ?? {};

  // Average of the last captured rating per session.
  const avgRows = (await q`
    SELECT avg(r)::float8 AS avg_rating FROM (
      SELECT DISTINCT ON (session_id) rating AS r
      FROM tap_events
      WHERE tenant_id = ${tenantId} AND type = 'REVIEW_RECEIVED'
            AND rating IS NOT NULL AND session_id <> ''
      ORDER BY session_id, created_at DESC
    ) last`) as { avg_rating: number | null }[];
  const averageRating = avgRows[0]?.avg_rating
    ? Math.round(avgRows[0].avg_rating * 100) / 100
    : 0;

  // Converted = sessions with both a tap and a WhatsApp click.
  const convRows = (await q`
    SELECT count(*)::int AS converted FROM (
      SELECT session_id FROM tap_events
      WHERE tenant_id = ${tenantId} AND session_id <> '' AND type IN ('NFC_TAP','WHATSAPP_CLICK')
      GROUP BY session_id
      HAVING bool_or(type = 'NFC_TAP') AND bool_or(type = 'WHATSAPP_CLICK')
    ) c`) as { converted: number }[];
  const converted = Number(convRows[0]?.converted ?? 0);
  const tapSessions = Number(s.tap_sessions ?? 0);
  const conversionRate = tapSessions ? Math.round((converted / tapSessions) * 1000) / 10 : 0;

  // 14-day NFC tap series (UTC days), gap-filled client of this query below.
  const seriesRows = (await q`
    SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           count(*)::int AS n
    FROM tap_events
    WHERE tenant_id = ${tenantId} AND type = 'NFC_TAP'
          AND created_at >= date_trunc('day', now()) - interval '13 days'
    GROUP BY 1 ORDER BY 1`) as { day: string; n: number }[];
  const seriesMap = new Map(seriesRows.map((r) => [r.day, Number(r.n)]));
  const taps14d = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: seriesMap.get(key) ?? 0 };
  });

  // Per-tag NFC stats, joined to the registry so zero-tap tags still appear.
  const tagRows = (await q`
    SELECT tag_code,
           count(*)::int AS taps,
           count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS taps_today,
           max(created_at) AS last_activity
    FROM tap_events
    WHERE tenant_id = ${tenantId} AND type = 'NFC_TAP' AND tag_code IS NOT NULL
    GROUP BY tag_code`) as { tag_code: string; taps: number; taps_today: number; last_activity: string }[];
  const tagStatMap = new Map(tagRows.map((r) => [r.tag_code, r]));
  const byCode = new Map(tags.map((t) => [t.code, t]));
  const codes = new Set<string>([...byCode.keys(), ...tagStatMap.keys()]);
  const topTags = [...codes]
    .map((code) => {
      const info = byCode.get(code);
      const st = tagStatMap.get(code);
      return {
        code,
        label: info?.label ?? "",
        isActive: info?.isActive ?? false,
        taps: Number(st?.taps ?? 0),
        tapsToday: Number(st?.taps_today ?? 0),
        lastActivity: st?.last_activity ? new Date(st.last_activity).toISOString() : null,
      };
    })
    .sort((a, b) => b.taps - a.taps || (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
    .slice(0, 8);

  return {
    totalTaps: Number(s.total_taps ?? 0),
    tapsToday: Number(s.taps_today ?? 0),
    whatsappClicks: Number(s.wa_clicks ?? 0),
    whatsappClicksToday: Number(s.wa_today ?? 0),
    reviews: Number(s.review_sessions ?? 0),
    averageRating,
    profileViews: Number(s.profile_views ?? 0),
    conversionRate,
    activeTags: tags.filter((t) => t.isActive).length,
    totalEvents: Number(s.total_events ?? 0),
    taps14d,
    topTags,
    generatedAt: now.toISOString(),
  };
}

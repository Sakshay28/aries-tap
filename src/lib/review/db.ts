// Durable store for the Review Experience — the private feedback and the funnel
// events. Same two-track design as the WiFi lead store: Neon Postgres when
// DATABASE_URL is set (lazily imported so builds never require it), and a JSON
// file fallback so the whole feature — including the dashboard — works locally
// with nothing configured.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TENANT_ID } from "./config";
import type {
  AiAnalysis,
  EventRow,
  FeedbackRow,
  Rating,
  ReviewEventName,
  ReviewStatus,
} from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
export const usingRealDb = Boolean(DATABASE_URL);

// Server-assembled records (post-validation) handed to the store.
export type NewFeedback = Omit<
  FeedbackRow,
  "id" | "createdAt" | "updatedAt" | "status" | "resolvedBy" | "resolvedAt" | "notes"
> & { ipHash: string };

export type NewEvent = {
  tenantId: string;
  sessionId: string;
  name: ReviewEventName;
  rating: number | null;
  meta: Record<string, string | number | boolean>;
  device: string;
  browser: string;
  os: string;
  country: string;
  city: string;
  ipHash: string;
  userAgent: string;
};

// ————————————————————————————————— Neon Postgres

let ensured = false;

async function sql() {
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(DATABASE_URL!);
  if (!ensured) {
    await q`
      CREATE TABLE IF NOT EXISTS review_feedback (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         text NOT NULL,
        session_id        text NOT NULL,
        rating            int  NOT NULL,
        feedback          text NOT NULL DEFAULT '',
        images            text[] NOT NULL DEFAULT '{}',
        name              text NOT NULL DEFAULT '',
        phone             text NOT NULL DEFAULT '',
        email             text NOT NULL DEFAULT '',
        contact_requested boolean NOT NULL DEFAULT false,
        device            text NOT NULL DEFAULT '',
        browser           text NOT NULL DEFAULT '',
        os                text NOT NULL DEFAULT '',
        country           text NOT NULL DEFAULT '',
        city              text NOT NULL DEFAULT '',
        table_no          text NOT NULL DEFAULT '',
        ip_hash           text NOT NULL DEFAULT '',
        ai                jsonb,
        status            text NOT NULL DEFAULT 'open',
        resolved_by       text NOT NULL DEFAULT '',
        resolved_at       timestamptz,
        notes             text NOT NULL DEFAULT '',
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now()
      )`;
    await q`CREATE INDEX IF NOT EXISTS review_feedback_tenant_idx ON review_feedback (tenant_id, created_at DESC)`;
    await q`
      CREATE TABLE IF NOT EXISTS review_events (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   text NOT NULL,
        session_id  text NOT NULL,
        name        text NOT NULL,
        rating      int,
        meta        jsonb NOT NULL DEFAULT '{}',
        device      text NOT NULL DEFAULT '',
        browser     text NOT NULL DEFAULT '',
        os          text NOT NULL DEFAULT '',
        country     text NOT NULL DEFAULT '',
        city        text NOT NULL DEFAULT '',
        ip_hash     text NOT NULL DEFAULT '',
        user_agent  text NOT NULL DEFAULT '',
        created_at  timestamptz NOT NULL DEFAULT now()
      )`;
    await q`CREATE INDEX IF NOT EXISTS review_events_tenant_idx ON review_events (tenant_id, created_at DESC)`;
    ensured = true;
  }
  return q;
}

// ————————————————————————————————— JSON fallback

const DIR =
  process.env.NODE_ENV === "production"
    ? os.tmpdir()
    : path.join(process.cwd(), ".data");
const FEEDBACK_FILE = path.join(DIR, "review_feedback.json");
const EVENTS_FILE = path.join(DIR, "review_events.json");

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

// ————————————————————————————————— row mapping (Neon → app)

function mapFeedback(r: Record<string, unknown>): FeedbackRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    sessionId: String(r.session_id),
    rating: Number(r.rating) as Rating,
    feedback: String(r.feedback ?? ""),
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
    name: String(r.name ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    contactRequested: Boolean(r.contact_requested),
    device: String(r.device ?? ""),
    browser: String(r.browser ?? ""),
    os: String(r.os ?? ""),
    country: String(r.country ?? ""),
    city: String(r.city ?? ""),
    table: String(r.table_no ?? ""),
    ai: (r.ai as AiAnalysis | null) ?? null,
    status: (String(r.status || "open") as ReviewStatus),
    resolvedBy: String(r.resolved_by ?? ""),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at as string).toISOString() : null,
    notes: String(r.notes ?? ""),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date((r.updated_at ?? r.created_at) as string).toISOString(),
  };
}

function mapEvent(r: Record<string, unknown>): EventRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    sessionId: String(r.session_id),
    name: String(r.name) as ReviewEventName,
    rating: r.rating == null ? undefined : Number(r.rating),
    meta: (r.meta as Record<string, string | number | boolean>) ?? {},
    device: String(r.device ?? ""),
    browser: String(r.browser ?? ""),
    os: String(r.os ?? ""),
    country: String(r.country ?? ""),
    city: String(r.city ?? ""),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// ————————————————————————————————— public API: feedback

export async function insertFeedback(
  f: NewFeedback
): Promise<{ id: string; createdAt: string }> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      INSERT INTO review_feedback
        (tenant_id, session_id, rating, feedback, images, name, phone, email,
         contact_requested, device, browser, os, country, city, table_no, ip_hash, ai)
      VALUES
        (${f.tenantId}, ${f.sessionId}, ${f.rating}, ${f.feedback}, ${f.images},
         ${f.name}, ${f.phone}, ${f.email}, ${f.contactRequested}, ${f.device},
         ${f.browser}, ${f.os}, ${f.country}, ${f.city}, ${f.table}, ${f.ipHash},
         ${f.ai ? JSON.stringify(f.ai) : null})
      RETURNING id, created_at`) as { id: string; created_at: string }[];
    return {
      id: String(rows[0].id),
      createdAt: new Date(rows[0].created_at).toISOString(),
    };
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const rows = await readJson<FeedbackRow>(FEEDBACK_FILE);
  rows.unshift({
    id,
    tenantId: f.tenantId,
    sessionId: f.sessionId,
    rating: f.rating,
    feedback: f.feedback,
    images: f.images,
    name: f.name,
    phone: f.phone,
    email: f.email,
    contactRequested: f.contactRequested,
    device: f.device,
    browser: f.browser,
    os: f.os,
    country: f.country,
    city: f.city,
    table: f.table,
    ai: f.ai,
    status: "open",
    resolvedBy: "",
    resolvedAt: null,
    notes: "",
    createdAt,
    updatedAt: createdAt,
  });
  await writeJson(FEEDBACK_FILE, rows);
  return { id, createdAt };
}

export async function updateFeedbackAi(id: string, ai: AiAnalysis): Promise<void> {
  if (usingRealDb) {
    const q = await sql();
    await q`
      UPDATE review_feedback SET ai = ${JSON.stringify(ai)}, updated_at = now()
      WHERE id = ${id} AND tenant_id = ${TENANT_ID}`;
    return;
  }
  const rows = await readJson<FeedbackRow>(FEEDBACK_FILE);
  const row = rows.find((r) => r.id === id);
  if (row) {
    row.ai = ai;
    row.updatedAt = new Date().toISOString();
    await writeJson(FEEDBACK_FILE, rows);
  }
}

export async function updateFeedbackStatus(opts: {
  id: string;
  status: ReviewStatus;
  notes?: string;
  resolvedBy?: string;
}): Promise<void> {
  const resolved = opts.status === "resolved" || opts.status === "closed";
  if (usingRealDb) {
    const q = await sql();
    await q`
      UPDATE review_feedback
      SET status = ${opts.status},
          notes = COALESCE(${opts.notes ?? null}, notes),
          resolved_by = COALESCE(${opts.resolvedBy ?? null}, resolved_by),
          resolved_at = ${resolved ? new Date().toISOString() : null},
          updated_at = now()
      WHERE id = ${opts.id} AND tenant_id = ${TENANT_ID}`;
    return;
  }
  const rows = await readJson<FeedbackRow>(FEEDBACK_FILE);
  const row = rows.find((r) => r.id === opts.id);
  if (row) {
    row.status = opts.status;
    if (opts.notes != null) row.notes = opts.notes;
    if (opts.resolvedBy != null) row.resolvedBy = opts.resolvedBy;
    row.resolvedAt = resolved ? new Date().toISOString() : null;
    row.updatedAt = new Date().toISOString();
    await writeJson(FEEDBACK_FILE, rows);
  }
}

// Feedback for one venue. `tenantId` defaults to this deployment's own tenant,
// so single-venue callers are unchanged; the owner dashboard passes each venue's
// id to read across a shared multi-venue database (and the local JSON store).
export async function listFeedback(
  tenantId: string = TENANT_ID,
  limit = 500
): Promise<FeedbackRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM review_feedback
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
    return rows.map(mapFeedback);
  }
  return (await readJson<FeedbackRow>(FEEDBACK_FILE))
    .filter((r) => r.tenantId === tenantId)
    .slice(0, limit);
}

// ————————————————————————————————— public API: events

export async function insertEvent(e: NewEvent): Promise<void> {
  if (usingRealDb) {
    const q = await sql();
    await q`
      INSERT INTO review_events
        (tenant_id, session_id, name, rating, meta, device, browser, os,
         country, city, ip_hash, user_agent)
      VALUES
        (${e.tenantId}, ${e.sessionId}, ${e.name}, ${e.rating}, ${JSON.stringify(e.meta)},
         ${e.device}, ${e.browser}, ${e.os}, ${e.country}, ${e.city}, ${e.ipHash},
         ${e.userAgent})`;
    return;
  }
  // Best-effort in fallback mode — never fail a guest's flow because the
  // ephemeral analytics store couldn't be written.
  try {
    const rows = await readJson<EventRow & { ipHash: string; userAgent: string }>(
      EVENTS_FILE
    );
    rows.unshift({
      id: crypto.randomUUID(),
      tenantId: e.tenantId,
      sessionId: e.sessionId,
      name: e.name,
      rating: e.rating ?? undefined,
      meta: e.meta,
      device: e.device,
      browser: e.browser,
      os: e.os,
      country: e.country,
      city: e.city,
      createdAt: new Date().toISOString(),
      ipHash: e.ipHash,
      userAgent: e.userAgent,
    });
    // Keep the fallback file bounded — it's for local dev, not archival.
    await writeJson(EVENTS_FILE, rows.slice(0, 5000));
  } catch (err) {
    console.error("[review] event fallback write failed (set DATABASE_URL)", err);
  }
}

export async function listEvents(
  tenantId: string = TENANT_ID,
  limit = 5000
): Promise<EventRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT id, tenant_id, session_id, name, rating, meta, device, browser, os,
             country, city, created_at
      FROM review_events
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
    return rows.map(mapEvent);
  }
  return (await readJson<EventRow>(EVENTS_FILE))
    .filter((r) => r.tenantId === tenantId)
    .slice(0, limit);
}

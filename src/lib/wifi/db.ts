// Durable lead store. Production: Neon Postgres (driver imported lazily, only
// when DATABASE_URL is set, so builds and local dev never require it). Dev
// fallback: a JSON file under .data/ so the admin dashboard works with no DB.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type Lead = {
  phone: string; // E.164
  venue: string;
  table: string; // guest-supplied seat/table, "" when they skipped it
  consent: boolean;
  consentVersion: string;
  ipHash: string;
  userAgent: string;
};

export type LeadRow = Lead & { id: string; createdAt: string };

const DATABASE_URL = process.env.DATABASE_URL;
export const usingRealDb = Boolean(DATABASE_URL);

// ————————————————————————————————— Neon Postgres

let ensured = false;

async function sql() {
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(DATABASE_URL!);
  if (!ensured) {
    await q`
      CREATE TABLE IF NOT EXISTS wifi_leads (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        phone       text NOT NULL,
        venue       text NOT NULL,
        consent     boolean NOT NULL DEFAULT true,
        consent_version text NOT NULL,
        ip_hash     text NOT NULL,
        user_agent  text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`;
    await q`CREATE INDEX IF NOT EXISTS wifi_leads_created_idx ON wifi_leads (created_at DESC)`;
    // Added after the first deployments shipped. CREATE TABLE IF NOT EXISTS
    // only ever creates — it will not add a column to a table that already
    // exists — so an explicit, idempotent ALTER is what actually migrates the
    // venues already running.
    await q`ALTER TABLE wifi_leads ADD COLUMN IF NOT EXISTS table_no text NOT NULL DEFAULT ''`;
    ensured = true;
  }
  return q;
}

// ————————————————————————————————— JSON fallback

// Local dev writes to ./.data; on a read-only serverless FS (Vercel without a
// DATABASE_URL) fall back to the writable temp dir so the flow never 500s.
// Either way the JSON store is best-effort and ephemeral — production sets
// DATABASE_URL for durable, queryable leads.
const DATA_FILE =
  process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "aries-leads.json")
    : path.join(process.cwd(), ".data", "leads.json");

async function readJson(): Promise<LeadRow[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as LeadRow[];
  } catch {
    return [];
  }
}

async function writeJson(rows: LeadRow[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2));
}

// ————————————————————————————————— Public API

export async function insertLead(lead: Lead): Promise<void> {
  if (usingRealDb) {
    const q = await sql();
    await q`
      INSERT INTO wifi_leads (phone, venue, consent, consent_version, ip_hash, user_agent, table_no)
      VALUES (${lead.phone}, ${lead.venue}, ${lead.consent}, ${lead.consentVersion}, ${lead.ipHash}, ${lead.userAgent}, ${lead.table})`;
    return;
  }
  // Best-effort in fallback mode: never fail a guest's WiFi because the
  // ephemeral JSON store couldn't be written. Real durability = DATABASE_URL.
  try {
    const rows = await readJson();
    rows.unshift({
      ...lead,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await writeJson(rows);
  } catch (err) {
    console.error("[wifi] JSON lead fallback write failed (set DATABASE_URL)", err);
  }
}

export async function listLeads(limit = 500): Promise<LeadRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT id, phone, venue, consent, consent_version, ip_hash, user_agent, table_no, created_at
      FROM wifi_leads ORDER BY created_at DESC LIMIT ${limit}`) as Record<
      string,
      unknown
    >[];
    return rows.map((r) => ({
      id: String(r.id),
      phone: String(r.phone),
      venue: String(r.venue),
      table: String(r.table_no ?? ""),
      consent: Boolean(r.consent),
      consentVersion: String(r.consent_version),
      ipHash: String(r.ip_hash),
      userAgent: String(r.user_agent),
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  // Rows written before table capture existed have no `table` at all. Default
  // it here so every consumer can treat the field as present.
  return (await readJson())
    .slice(0, limit)
    .map((r) => ({ ...r, table: r.table ?? "" }));
}

export async function leadStats(): Promise<{ total: number; today: number }> {
  if (usingRealDb) {
    const q = await sql();
    const [{ total }] = (await q`SELECT count(*)::int AS total FROM wifi_leads`) as {
      total: number;
    }[];
    const [{ today }] = (await q`
      SELECT count(*)::int AS today FROM wifi_leads
      WHERE created_at >= date_trunc('day', now())`) as { today: number }[];
    return { total, today };
  }
  const rows = await readJson();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = rows.filter((r) => new Date(r.createdAt) >= start).length;
  return { total: rows.length, today };
}

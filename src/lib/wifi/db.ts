// Durable lead store. Production: Neon Postgres (driver imported lazily, only
// when DATABASE_URL is set, so builds and local dev never require it). Dev
// fallback: a JSON file under .data/ so the admin dashboard works with no DB.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { business } from "@/lib/content";

// The tenant a lead belongs to. In a single-venue deployment this is the one
// venue; on a shared multi-venue database it is what keeps each venue's numbers
// its own (and what the owner dashboard scopes by). Legacy rows written before
// this column existed default to the deployment's own tenant on read.
const DEFAULT_TENANT = process.env.ARIES_TENANT_ID || business.id;

export type Lead = {
  phone: string; // E.164
  tenantId: string; // owning venue, e.g. "taffeta"
  venue: string;
  table: string; // from the resolver's visit cookie, "" when they never scanned
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
    // Tenant scoping for the shared multi-venue database. Postgres forbids a
    // bound parameter in a DDL DEFAULT, so the column defaults to '' (a literal),
    // and a separate UPDATE — where a parameter IS allowed — backfills existing
    // rows to this deployment's own tenant. Idempotent: after the first run it
    // matches no rows (new inserts set tenant_id explicitly).
    await q`ALTER TABLE wifi_leads ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT ''`;
    await q`UPDATE wifi_leads SET tenant_id = ${DEFAULT_TENANT} WHERE tenant_id = ''`;
    await q`CREATE INDEX IF NOT EXISTS wifi_leads_tenant_idx ON wifi_leads (tenant_id, created_at DESC)`;
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
      INSERT INTO wifi_leads (phone, venue, consent, consent_version, ip_hash, user_agent, table_no, tenant_id)
      VALUES (${lead.phone}, ${lead.venue}, ${lead.consent}, ${lead.consentVersion}, ${lead.ipHash}, ${lead.userAgent}, ${lead.table}, ${lead.tenantId})`;
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

// Leads for one venue. `tenantId` scopes the read on the shared database (and
// filters the local JSON store the same way); omit it only for a single-venue
// tool that legitimately wants every row.
export async function listLeads(tenantId?: string, limit = 500): Promise<LeadRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (
      tenantId
        ? await q`
            SELECT id, phone, venue, consent, consent_version, ip_hash, user_agent, table_no, tenant_id, created_at
            FROM wifi_leads WHERE tenant_id = ${tenantId}
            ORDER BY created_at DESC LIMIT ${limit}`
        : await q`
            SELECT id, phone, venue, consent, consent_version, ip_hash, user_agent, table_no, tenant_id, created_at
            FROM wifi_leads ORDER BY created_at DESC LIMIT ${limit}`
    ) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      phone: String(r.phone),
      tenantId: String(r.tenant_id ?? DEFAULT_TENANT),
      venue: String(r.venue),
      table: String(r.table_no ?? ""),
      consent: Boolean(r.consent),
      consentVersion: String(r.consent_version),
      ipHash: String(r.ip_hash),
      userAgent: String(r.user_agent),
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  // Rows written before these columns existed have no `table`/`tenantId`.
  // Default them here so every consumer can treat the fields as present, then
  // scope to the requested venue.
  const all = (await readJson()).map((r) => ({
    ...r,
    table: r.table ?? "",
    tenantId: r.tenantId ?? DEFAULT_TENANT,
  }));
  return (tenantId ? all.filter((r) => r.tenantId === tenantId) : all).slice(0, limit);
}

export async function leadStats(tenantId?: string): Promise<{ total: number; today: number }> {
  if (usingRealDb) {
    const q = await sql();
    const [{ total }] = (
      tenantId
        ? await q`SELECT count(*)::int AS total FROM wifi_leads WHERE tenant_id = ${tenantId}`
        : await q`SELECT count(*)::int AS total FROM wifi_leads`
    ) as { total: number }[];
    const [{ today }] = (
      tenantId
        ? await q`SELECT count(*)::int AS today FROM wifi_leads
            WHERE tenant_id = ${tenantId} AND created_at >= date_trunc('day', now())`
        : await q`SELECT count(*)::int AS today FROM wifi_leads
            WHERE created_at >= date_trunc('day', now())`
    ) as { today: number }[];
    return { total, today };
  }
  const rows = tenantId
    ? (await readJson()).filter((r) => (r.tenantId ?? DEFAULT_TENANT) === tenantId)
    : await readJson();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = rows.filter((r) => new Date(r.createdAt) >= start).length;
  return { total: rows.length, today };
}

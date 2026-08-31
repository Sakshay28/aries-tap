// Durable store for the dynamic QR system — the same two-track design as the
// WiFi, Review and Play & Win stores: Neon Postgres when DATABASE_URL is set
// (lazily imported so a build never requires it), and a JSON-file fallback so
// the whole feature runs locally with nothing configured.
//
// Three tables:
//   qr_codes      — one row per physical QR. `code` is what's printed; only
//                   `destination_url` ever changes. This is the whole feature.
//   qr_scans      — one row per resolved scan. Anonymous telemetry.
//   qr_audit_log  — one row per administrative mutation. Doubles as the
//                   destination-change history shown in the dashboard.
//
// Named qr_audit_log rather than qr_events deliberately: `review_events` in
// this codebase means guest-facing funnel telemetry, and this is the opposite —
// low-volume, admin-attributed mutation history.

// Every admin function takes an explicit `tenantId` — the same posture as
// events/db.ts. The caller resolves it authoritatively from the signed admin
// session (see resolveOwnerTenant); this layer never reaches for a build-time
// constant, so one running process and one table can serve many venues and a
// query is physically incapable of returning another tenant's rows. The
// resolver's guest hot path is deliberately tenant-agnostic (getQrByCodeGlobal),
// because a globally-unique printed code is owned by exactly one venue.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  QrAuditAction,
  QrAuditRow,
  QrCodeRow,
  QrScanStats,
} from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
export const usingRealDb = Boolean(DATABASE_URL);

// Thrown when a code that's already taken is registered again. The API turns
// this into a 409 — a printed code must never silently rebind to a new row.
export class DuplicateCodeError extends Error {
  constructor(code: string) {
    super(`QR code "${code}" already exists.`);
    this.name = "DuplicateCodeError";
  }
}

// —————————————————————————————— Neon Postgres

let ensured = false;

async function sql() {
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(DATABASE_URL!);
  if (!ensured) {
    await q`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       text NOT NULL,
        code            text NOT NULL,
        destination_url text NOT NULL,
        label           text NOT NULL DEFAULT '',
        table_no        text NOT NULL DEFAULT '',
        is_active       boolean NOT NULL DEFAULT true,
        scan_count      bigint NOT NULL DEFAULT 0,
        archived_at     timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      )`;
    // Tags created before per-table attribution shipped predate this column,
    // and CREATE TABLE IF NOT EXISTS will never add it to them.
    await q`ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS table_no text NOT NULL DEFAULT ''`;
    await q`CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_code_key ON qr_codes (code)`;
    await q`CREATE INDEX IF NOT EXISTS qr_codes_tenant_idx ON qr_codes (tenant_id, created_at DESC)`;
    await q`
      CREATE TABLE IF NOT EXISTS qr_scans (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_code_id  uuid NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
        tenant_id   text NOT NULL,
        scanned_at  timestamptz NOT NULL DEFAULT now(),
        user_agent  text NOT NULL DEFAULT '',
        referer     text NOT NULL DEFAULT ''
      )`;
    await q`CREATE INDEX IF NOT EXISTS qr_scans_qr_idx ON qr_scans (qr_code_id, scanned_at DESC)`;
    await q`
      CREATE TABLE IF NOT EXISTS qr_audit_log (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_code_id  uuid NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
        tenant_id   text NOT NULL,
        action      text NOT NULL,
        from_value  text NOT NULL DEFAULT '',
        to_value    text NOT NULL DEFAULT '',
        actor       text NOT NULL DEFAULT 'admin',
        created_at  timestamptz NOT NULL DEFAULT now()
      )`;
    await q`CREATE INDEX IF NOT EXISTS qr_audit_qr_idx ON qr_audit_log (qr_code_id, created_at DESC)`;
    ensured = true;
  }
  return q;
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "23505";
}

// —————————————————————————————— JSON fallback

const DIR =
  process.env.NODE_ENV === "production"
    ? os.tmpdir()
    : path.join(process.cwd(), ".data");
const CODES_FILE = path.join(DIR, "qr_codes.json");
const SCANS_FILE = path.join(DIR, "qr_scans.json");
const AUDIT_FILE = path.join(DIR, "qr_audit_log.json");

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

// The JSON fallback is a single-process dev convenience, but scan-logging is
// concurrent even in dev (a page with several tabs, a double-tap). Serialize
// read-modify-write cycles through a promise chain so an increment can't be
// lost to an interleaved write.
let jsonLock: Promise<unknown> = Promise.resolve();
function withJsonLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = jsonLock.then(fn, fn);
  jsonLock = next.catch(() => {});
  return next;
}

// —————————————————————————————— row mapping (Neon → app)

function mapCode(r: Record<string, unknown>): QrCodeRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    code: String(r.code),
    destinationUrl: String(r.destination_url),
    label: String(r.label ?? ""),
    table: String(r.table_no ?? ""),
    isActive: Boolean(r.is_active),
    scanCount: Number(r.scan_count ?? 0),
    archivedAt: r.archived_at ? new Date(r.archived_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function mapAudit(r: Record<string, unknown>): QrAuditRow {
  return {
    id: String(r.id),
    qrCodeId: String(r.qr_code_id),
    tenantId: String(r.tenant_id),
    action: String(r.action) as QrAuditAction,
    fromValue: String(r.from_value ?? ""),
    toValue: String(r.to_value ?? ""),
    actor: String(r.actor ?? "admin"),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// —————————————————————————————— audit

async function logAudit(tenantId: string, entry: {
  qrCodeId: string;
  action: QrAuditAction;
  fromValue?: string;
  toValue?: string;
  actor?: string;
}): Promise<void> {
  const row: QrAuditRow = {
    id: crypto.randomUUID(),
    qrCodeId: entry.qrCodeId,
    tenantId,
    action: entry.action,
    fromValue: entry.fromValue ?? "",
    toValue: entry.toValue ?? "",
    actor: entry.actor ?? "admin",
    createdAt: new Date().toISOString(),
  };

  if (usingRealDb) {
    const q = await sql();
    await q`
      INSERT INTO qr_audit_log (qr_code_id, tenant_id, action, from_value, to_value, actor)
      VALUES (${row.qrCodeId}, ${row.tenantId}, ${row.action}, ${row.fromValue}, ${row.toValue}, ${row.actor})`;
    return;
  }
  await withJsonLock(async () => {
    const rows = await readJson<QrAuditRow>(AUDIT_FILE);
    rows.unshift(row);
    await writeJson(AUDIT_FILE, rows);
  });
}

export async function listAudit(tenantId: string, qrCodeId: string, limit = 100): Promise<QrAuditRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM qr_audit_log
      WHERE qr_code_id = ${qrCodeId} AND tenant_id = ${tenantId}
      ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
    return rows.map(mapAudit);
  }
  const rows = await readJson<QrAuditRow>(AUDIT_FILE);
  return rows
    .filter((r) => r.qrCodeId === qrCodeId && r.tenantId === tenantId)
    .slice(0, limit);
}

// —————————————————————————————— codes

export async function createQrCode(tenantId: string, input: {
  code: string;
  destinationUrl: string;
  label?: string;
  table?: string;
}): Promise<QrCodeRow> {
  if (usingRealDb) {
    const q = await sql();
    let rows: Record<string, unknown>[];
    try {
      rows = (await q`
        INSERT INTO qr_codes (tenant_id, code, destination_url, label, table_no)
        VALUES (${tenantId}, ${input.code}, ${input.destinationUrl}, ${input.label ?? ""}, ${input.table ?? ""})
        RETURNING *`) as Record<string, unknown>[];
    } catch (err) {
      if (isUniqueViolation(err)) throw new DuplicateCodeError(input.code);
      throw err;
    }
    const row = mapCode(rows[0]);
    await logAudit(tenantId, { qrCodeId: row.id, action: "created", toValue: row.destinationUrl });
    return row;
  }

  const row = await withJsonLock(async () => {
    const rows = await readJson<QrCodeRow>(CODES_FILE);
    if (rows.some((r) => r.code === input.code)) throw new DuplicateCodeError(input.code);
    const now = new Date().toISOString();
    const created: QrCodeRow = {
      id: crypto.randomUUID(),
      tenantId,
      code: input.code,
      destinationUrl: input.destinationUrl,
      label: input.label ?? "",
      table: input.table ?? "",
      isActive: true,
      scanCount: 0,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    rows.unshift(created);
    await writeJson(CODES_FILE, rows);
    return created;
  });
  await logAudit(tenantId, { qrCodeId: row.id, action: "created", toValue: row.destinationUrl });
  return row;
}

// Tenant-agnostic lookup by printed code — the authoritative "who owns this
// tag?" question the resolver (guest hot path) and the multi-tenant write path
// both ask. `code` is globally unique in the registry, so this returns at most
// one row, and its `tenant_id` is the tag's rightful owner no matter who
// presents the code (spec §20–§21). This is deliberately the ONLY by-code
// lookup: a build-time-tenant-scoped variant would silently fail to resolve
// another venue's tag on a shared deployment. Admin surfaces read by id instead
// (getQrById), scoped to the caller's resolved session tenant.
export async function getQrByCodeGlobal(code: string): Promise<QrCodeRow | null> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM qr_codes WHERE code = ${code} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ? mapCode(rows[0]) : null;
  }
  const rows = await readJson<QrCodeRow>(CODES_FILE);
  return rows.find((r) => r.code === code) ?? null;
}

export async function getQrById(tenantId: string, id: string): Promise<QrCodeRow | null> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM qr_codes
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ? mapCode(rows[0]) : null;
  }
  const rows = await readJson<QrCodeRow>(CODES_FILE);
  return rows.find((r) => r.id === id && r.tenantId === tenantId) ?? null;
}

// The tag listing every admin surface reads, scoped to an explicit tenant. The
// caller resolves the tenant from the signed session and asks for exactly that
// business's tags, so the tag table it renders can never include another
// tenant's codes even when many venues share one database and one deployment.
export async function listQrCodesForTenant(tenantId: string, limit = 500): Promise<QrCodeRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM qr_codes
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
    return rows.map(mapCode);
  }
  const rows = await readJson<QrCodeRow>(CODES_FILE);
  return rows.filter((r) => r.tenantId === tenantId).slice(0, limit);
}

// Note there is deliberately no way to change `code` — renaming a printed
// identifier would orphan every physical copy already in the world.
export async function updateQrCode(
  tenantId: string,
  id: string,
  patch: { destinationUrl?: string; label?: string; isActive?: boolean },
): Promise<QrCodeRow | null> {
  const before = await getQrById(tenantId, id);
  if (!before) return null;

  const destinationUrl = patch.destinationUrl ?? before.destinationUrl;
  const label = patch.label ?? before.label;
  const isActive = patch.isActive ?? before.isActive;

  let after: QrCodeRow | null;
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      UPDATE qr_codes
      SET destination_url = ${destinationUrl},
          label = ${label},
          is_active = ${isActive},
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`) as Record<string, unknown>[];
    after = rows[0] ? mapCode(rows[0]) : null;
  } else {
    after = await withJsonLock(async () => {
      const rows = await readJson<QrCodeRow>(CODES_FILE);
      const i = rows.findIndex((r) => r.id === id && r.tenantId === tenantId);
      if (i < 0) return null;
      rows[i] = {
        ...rows[i],
        destinationUrl,
        label,
        isActive,
        updatedAt: new Date().toISOString(),
      };
      await writeJson(CODES_FILE, rows);
      return rows[i];
    });
  }
  if (!after) return null;

  if (patch.destinationUrl !== undefined && patch.destinationUrl !== before.destinationUrl) {
    await logAudit(tenantId, {
      qrCodeId: id,
      action: "destination_changed",
      fromValue: before.destinationUrl,
      toValue: after.destinationUrl,
    });
  }
  if (patch.isActive !== undefined && patch.isActive !== before.isActive) {
    await logAudit(tenantId, { qrCodeId: id, action: after.isActive ? "activated" : "deactivated" });
  }
  return after;
}

// Soft-archive only. A printed QR's row is never destroyed — an archived code
// stops redirecting but keeps its history and stays recoverable.
export async function archiveQrCode(tenantId: string, id: string): Promise<QrCodeRow | null> {
  let after: QrCodeRow | null;
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      UPDATE qr_codes
      SET is_active = false, archived_at = now(), updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId} AND archived_at IS NULL
      RETURNING *`) as Record<string, unknown>[];
    after = rows[0] ? mapCode(rows[0]) : null;
    if (!after) return getQrById(tenantId, id);
  } else {
    after = await withJsonLock(async () => {
      const rows = await readJson<QrCodeRow>(CODES_FILE);
      const i = rows.findIndex((r) => r.id === id && r.tenantId === tenantId);
      if (i < 0) return null;
      if (rows[i].archivedAt) return rows[i];
      const now = new Date().toISOString();
      rows[i] = { ...rows[i], isActive: false, archivedAt: now, updatedAt: now };
      await writeJson(CODES_FILE, rows);
      return rows[i];
    });
    if (!after) return null;
  }
  await logAudit(tenantId, { qrCodeId: id, action: "archived" });
  return after;
}

// —————————————————————————————— scans

// Called from after() so it never delays a guest's redirect. The counter uses a
// single atomic UPDATE — Postgres row locking makes concurrent increments safe
// with no read-modify-write race and no retry loop.
export async function recordScan(tenantId: string, input: {
  qrCodeId: string;
  userAgent: string;
  referer: string;
}): Promise<void> {
  if (usingRealDb) {
    const q = await sql();
    await q`
      UPDATE qr_codes SET scan_count = scan_count + 1
      WHERE id = ${input.qrCodeId} AND tenant_id = ${tenantId}`;
    await q`
      INSERT INTO qr_scans (qr_code_id, tenant_id, user_agent, referer)
      VALUES (${input.qrCodeId}, ${tenantId}, ${input.userAgent}, ${input.referer})`;
    return;
  }

  await withJsonLock(async () => {
    const codes = await readJson<QrCodeRow>(CODES_FILE);
    const i = codes.findIndex((r) => r.id === input.qrCodeId);
    if (i >= 0) {
      codes[i] = { ...codes[i], scanCount: codes[i].scanCount + 1 };
      await writeJson(CODES_FILE, codes);
    }
    const scans = await readJson<Record<string, unknown>>(SCANS_FILE);
    scans.unshift({
      id: crypto.randomUUID(),
      qrCodeId: input.qrCodeId,
      tenantId,
      scannedAt: new Date().toISOString(),
      userAgent: input.userAgent,
      referer: input.referer,
    });
    await writeJson(SCANS_FILE, scans.slice(0, 5000));
  });
}

export async function scanStats(tenantId: string, qrCodeId: string): Promise<QrScanStats> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE scanned_at >= date_trunc('day', now()))::int AS today,
        count(*) FILTER (WHERE scanned_at >= now() - interval '7 days')::int AS week,
        count(*) FILTER (WHERE scanned_at >= now() - interval '30 days')::int AS month
      FROM qr_scans
      WHERE qr_code_id = ${qrCodeId} AND tenant_id = ${tenantId}`) as Record<string, number>[];
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      today: Number(r.today ?? 0),
      week: Number(r.week ?? 0),
      month: Number(r.month ?? 0),
    };
  }

  const scans = await readJson<{ qrCodeId: string; scannedAt: string }>(SCANS_FILE);
  const mine = scans.filter((s) => s.qrCodeId === qrCodeId);
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = (ms: number) => mine.filter((s) => now - new Date(s.scannedAt).getTime() <= ms).length;
  return {
    total: mine.length,
    today: mine.filter((s) => new Date(s.scannedAt) >= startOfDay).length,
    week: since(7 * 864e5),
    month: since(30 * 864e5),
  };
}

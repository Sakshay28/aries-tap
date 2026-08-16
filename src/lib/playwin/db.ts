// Durable store for Play & Win — the same two-track design as the WiFi and
// Review stores: Neon Postgres when DATABASE_URL is set (lazily imported so a
// build never requires it), and a JSON-file fallback so the whole feature —
// games, claims, redemption, dashboard — runs locally with nothing configured.
//
// Two tables:
//   playwin_plays   — one row per game played (win or not). The analytics base.
//   playwin_claims  — one row per reward a guest chose to claim (the leads +
//                     the redemption ledger). `status` is the single source of
//                     truth for "already redeemed", enforced on write.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TENANT_ID } from "./config";
import type { ClaimRow, ClaimStatus, PlayRow } from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
export const usingRealDb = Boolean(DATABASE_URL);

export type NewPlay = Omit<PlayRow, "id" | "createdAt" | "claimed">;
export type NewClaim = Omit<
  ClaimRow,
  "id" | "createdAt" | "status" | "redeemedAt" | "redeemedBy"
> & { status?: ClaimStatus };

// —————————————————————————————— Neon Postgres

let ensured = false;

async function sql() {
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(DATABASE_URL!);
  if (!ensured) {
    await q`
      CREATE TABLE IF NOT EXISTS playwin_plays (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     text NOT NULL,
        session_id    text NOT NULL DEFAULT '',
        device_hash   text NOT NULL DEFAULT '',
        game_key      text NOT NULL,
        reward_id     text NOT NULL,
        reward_title  text NOT NULL DEFAULT '',
        win           boolean NOT NULL DEFAULT false,
        table_no      text NOT NULL DEFAULT '',
        device        text NOT NULL DEFAULT '',
        browser       text NOT NULL DEFAULT '',
        os            text NOT NULL DEFAULT '',
        country       text NOT NULL DEFAULT '',
        city          text NOT NULL DEFAULT '',
        ip_hash       text NOT NULL DEFAULT '',
        claimed       boolean NOT NULL DEFAULT false,
        created_at    timestamptz NOT NULL DEFAULT now()
      )`;
    await q`CREATE INDEX IF NOT EXISTS playwin_plays_tenant_idx ON playwin_plays (tenant_id, created_at DESC)`;
    await q`
      CREATE TABLE IF NOT EXISTS playwin_claims (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id          text NOT NULL,
        play_id            text NOT NULL,
        game_key           text NOT NULL DEFAULT '',
        reward_id          text NOT NULL,
        reward_title       text NOT NULL DEFAULT '',
        coupon_code        text NOT NULL,
        name               text NOT NULL DEFAULT '',
        phone              text NOT NULL DEFAULT '',
        whatsapp           text NOT NULL DEFAULT '',
        birthday           text NOT NULL DEFAULT '',
        email              text NOT NULL DEFAULT '',
        marketing_consent  boolean NOT NULL DEFAULT false,
        device_hash        text NOT NULL DEFAULT '',
        status             text NOT NULL DEFAULT 'issued',
        redeemed_at        timestamptz,
        redeemed_by        text NOT NULL DEFAULT '',
        table_no           text NOT NULL DEFAULT '',
        country            text NOT NULL DEFAULT '',
        city               text NOT NULL DEFAULT '',
        created_at         timestamptz NOT NULL DEFAULT now(),
        expires_at         timestamptz NOT NULL
      )`;
    await q`CREATE INDEX IF NOT EXISTS playwin_claims_tenant_idx ON playwin_claims (tenant_id, created_at DESC)`;
    await q`CREATE INDEX IF NOT EXISTS playwin_claims_reward_idx ON playwin_claims (tenant_id, reward_id)`;
    ensured = true;
  }
  return q;
}

// —————————————————————————————— JSON fallback

const DIR =
  process.env.NODE_ENV === "production"
    ? os.tmpdir()
    : path.join(process.cwd(), ".data");
const PLAYS_FILE = path.join(DIR, "playwin_plays.json");
const CLAIMS_FILE = path.join(DIR, "playwin_claims.json");

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

// —————————————————————————————— row mapping (Neon → app)

function mapPlay(r: Record<string, unknown>): PlayRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    sessionId: String(r.session_id ?? ""),
    deviceHash: String(r.device_hash ?? ""),
    gameKey: String(r.game_key),
    rewardId: String(r.reward_id),
    rewardTitle: String(r.reward_title ?? ""),
    win: Boolean(r.win),
    table: String(r.table_no ?? ""),
    device: String(r.device ?? ""),
    browser: String(r.browser ?? ""),
    os: String(r.os ?? ""),
    country: String(r.country ?? ""),
    city: String(r.city ?? ""),
    ipHash: String(r.ip_hash ?? ""),
    claimed: Boolean(r.claimed),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function mapClaim(r: Record<string, unknown>): ClaimRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    playId: String(r.play_id),
    gameKey: String(r.game_key ?? ""),
    rewardId: String(r.reward_id),
    rewardTitle: String(r.reward_title ?? ""),
    couponCode: String(r.coupon_code),
    name: String(r.name ?? ""),
    phone: String(r.phone ?? ""),
    whatsapp: String(r.whatsapp ?? ""),
    birthday: String(r.birthday ?? ""),
    email: String(r.email ?? ""),
    marketingConsent: Boolean(r.marketing_consent),
    deviceHash: String(r.device_hash ?? ""),
    status: String(r.status || "issued") as ClaimStatus,
    redeemedAt: r.redeemed_at ? new Date(r.redeemed_at as string).toISOString() : null,
    redeemedBy: String(r.redeemed_by ?? ""),
    table: String(r.table_no ?? ""),
    country: String(r.country ?? ""),
    city: String(r.city ?? ""),
    createdAt: new Date(r.created_at as string).toISOString(),
    expiresAt: new Date(r.expires_at as string).toISOString(),
  };
}

// A stored "issued" claim past its expiry reads as expired without a writer.
function withExpiry(row: ClaimRow): ClaimRow {
  if (row.status === "issued" && Date.now() > new Date(row.expiresAt).getTime()) {
    return { ...row, status: "expired" };
  }
  return row;
}

// —————————————————————————————— plays

export async function insertPlay(p: NewPlay): Promise<{ id: string; createdAt: string }> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      INSERT INTO playwin_plays
        (tenant_id, session_id, device_hash, game_key, reward_id, reward_title,
         win, table_no, device, browser, os, country, city, ip_hash)
      VALUES
        (${p.tenantId}, ${p.sessionId}, ${p.deviceHash}, ${p.gameKey}, ${p.rewardId},
         ${p.rewardTitle}, ${p.win}, ${p.table}, ${p.device}, ${p.browser}, ${p.os},
         ${p.country}, ${p.city}, ${p.ipHash})
      RETURNING id, created_at`) as { id: string; created_at: string }[];
    return { id: String(rows[0].id), createdAt: new Date(rows[0].created_at).toISOString() };
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const rows = await readJson<PlayRow>(PLAYS_FILE);
  rows.unshift({ ...p, id, claimed: false, createdAt });
  await writeJson(PLAYS_FILE, rows.slice(0, 20000));
  return { id, createdAt };
}

export async function getPlay(id: string): Promise<PlayRow | null> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM playwin_plays WHERE id = ${id} AND tenant_id = ${TENANT_ID}
      LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ? mapPlay(rows[0]) : null;
  }
  const rows = await readJson<PlayRow>(PLAYS_FILE);
  return rows.find((r) => r.id === id) ?? null;
}

export async function markPlayClaimed(id: string): Promise<void> {
  if (usingRealDb) {
    const q = await sql();
    await q`UPDATE playwin_plays SET claimed = true WHERE id = ${id} AND tenant_id = ${TENANT_ID}`;
    return;
  }
  const rows = await readJson<PlayRow>(PLAYS_FILE);
  const row = rows.find((r) => r.id === id);
  if (row) {
    row.claimed = true;
    await writeJson(PLAYS_FILE, rows);
  }
}

export async function listPlays(limit = 5000): Promise<PlayRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM playwin_plays WHERE tenant_id = ${TENANT_ID}
      ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
    return rows.map(mapPlay);
  }
  return (await readJson<PlayRow>(PLAYS_FILE)).slice(0, limit);
}

// —————————————————————————————— claims

export async function insertClaim(c: NewClaim): Promise<{ id: string; createdAt: string }> {
  const status = c.status ?? "issued";
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      INSERT INTO playwin_claims
        (tenant_id, play_id, game_key, reward_id, reward_title, coupon_code, name,
         phone, whatsapp, birthday, email, marketing_consent, device_hash, status,
         table_no, country, city, expires_at)
      VALUES
        (${c.tenantId}, ${c.playId}, ${c.gameKey}, ${c.rewardId}, ${c.rewardTitle},
         ${c.couponCode}, ${c.name}, ${c.phone}, ${c.whatsapp}, ${c.birthday},
         ${c.email}, ${c.marketingConsent}, ${c.deviceHash}, ${status}, ${c.table},
         ${c.country}, ${c.city}, ${c.expiresAt})
      RETURNING id, created_at`) as { id: string; created_at: string }[];
    return { id: String(rows[0].id), createdAt: new Date(rows[0].created_at).toISOString() };
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const rows = await readJson<ClaimRow>(CLAIMS_FILE);
  rows.unshift({
    ...c,
    id,
    status,
    redeemedAt: null,
    redeemedBy: "",
    createdAt,
  });
  await writeJson(CLAIMS_FILE, rows.slice(0, 20000));
  return { id, createdAt };
}

export async function getClaim(id: string): Promise<ClaimRow | null> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT * FROM playwin_claims WHERE id = ${id} AND tenant_id = ${TENANT_ID}
      LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ? withExpiry(mapClaim(rows[0])) : null;
  }
  const rows = await readJson<ClaimRow>(CLAIMS_FILE);
  const row = rows.find((r) => r.id === id);
  return row ? withExpiry(row) : null;
}

// Single-use redemption. Returns the updated row plus whether this call was the
// one that redeemed it. The Neon path flips status only WHERE status='issued',
// so two concurrent scans can't both succeed.
export type RedeemOutcome =
  | { ok: true; row: ClaimRow }
  | { ok: false; reason: "not_found" | "expired" | "already_redeemed"; row: ClaimRow | null };

export async function redeemClaim(id: string, redeemedBy: string): Promise<RedeemOutcome> {
  const current = await getClaim(id);
  if (!current) return { ok: false, reason: "not_found", row: null };
  if (current.status === "expired") return { ok: false, reason: "expired", row: current };
  if (current.status === "redeemed") {
    return { ok: false, reason: "already_redeemed", row: current };
  }

  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      UPDATE playwin_claims
      SET status = 'redeemed', redeemed_at = now(), redeemed_by = ${redeemedBy}
      WHERE id = ${id} AND tenant_id = ${TENANT_ID} AND status = 'issued'
      RETURNING *`) as Record<string, unknown>[];
    if (rows[0]) return { ok: true, row: mapClaim(rows[0]) };
    // Lost the race — re-read to report the authoritative state.
    const after = await getClaim(id);
    return { ok: false, reason: "already_redeemed", row: after };
  }

  const rows = await readJson<ClaimRow>(CLAIMS_FILE);
  const row = rows.find((r) => r.id === id);
  if (!row) return { ok: false, reason: "not_found", row: null };
  if (row.status !== "issued") {
    return { ok: false, reason: "already_redeemed", row: withExpiry(row) };
  }
  row.status = "redeemed";
  row.redeemedAt = new Date().toISOString();
  row.redeemedBy = redeemedBy;
  await writeJson(CLAIMS_FILE, rows);
  return { ok: true, row };
}

export async function listClaims(limit = 5000): Promise<ClaimRow[]> {
  const rows = usingRealDb
    ? await (async () => {
        const q = await sql();
        const r = (await q`
          SELECT * FROM playwin_claims WHERE tenant_id = ${TENANT_ID}
          ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
        return r.map(mapClaim);
      })()
    : (await readJson<ClaimRow>(CLAIMS_FILE)).slice(0, limit);
  return rows.map(withExpiry);
}

// Lifetime claim counts per reward — only queried when a game has rewards with
// a `maxClaims` cap, so the engine can drop an exhausted prize from the draw.
export async function countClaimsForRewards(
  rewardIds: string[],
): Promise<Record<string, number>> {
  if (rewardIds.length === 0) return {};
  const out: Record<string, number> = {};
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT reward_id, count(*)::int AS n FROM playwin_claims
      WHERE tenant_id = ${TENANT_ID} AND reward_id = ANY(${rewardIds})
      GROUP BY reward_id`) as { reward_id: string; n: number }[];
    for (const r of rows) out[r.reward_id] = Number(r.n);
    return out;
  }
  const rows = await readJson<ClaimRow>(CLAIMS_FILE);
  for (const id of rewardIds) out[id] = rows.filter((r) => r.rewardId === id).length;
  return out;
}

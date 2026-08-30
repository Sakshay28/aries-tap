// Durable log of AI Host conversations. Same two-track design as the WiFi lead
// store: Neon Postgres when DATABASE_URL is set (driver imported lazily so a
// build never requires it), and a JSON-file fallback under .data/ so the owner
// dashboard's "AI Chat" history works locally with nothing configured.
//
// One row per completed turn — the guest's question and the Host's full answer,
// stamped with the table the guest scanned from (the `aries_table` visit cookie,
// "" when they arrived without scanning) and the moment it finished. That is
// exactly what the owner sees in the dashboard: what people are asking, from
// which table, over time.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type ChatTurn = {
  tenantId: string;
  table: string; // guest's table from the visit cookie, "" when unknown
  question: string;
  answer: string;
};

export type ChatTurnRow = ChatTurn & { id: string; createdAt: string };

const DATABASE_URL = process.env.DATABASE_URL;
export const usingRealDb = Boolean(DATABASE_URL);

// ————————————————————————————————— Neon Postgres

let ensured = false;

async function sql() {
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(DATABASE_URL!);
  if (!ensured) {
    await q`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   text NOT NULL,
        table_no    text NOT NULL DEFAULT '',
        question    text NOT NULL,
        answer      text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`;
    await q`CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (tenant_id, created_at DESC)`;
    ensured = true;
  }
  return q;
}

// ————————————————————————————————— JSON fallback

// Local dev writes to ./.data; on a read-only serverless FS (Vercel without a
// DATABASE_URL) fall back to the writable temp dir so a chat never 500s over
// logging. Best-effort and ephemeral either way — production sets DATABASE_URL
// for durable, queryable history.
const DATA_FILE =
  process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "aries-chat.json")
    : path.join(process.cwd(), ".data", "chat_messages.json");

async function readJson(): Promise<ChatTurnRow[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as ChatTurnRow[];
  } catch {
    return [];
  }
}

async function writeJson(rows: ChatTurnRow[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2));
}

// ————————————————————————————————— Public API

export async function insertChatTurn(turn: ChatTurn): Promise<void> {
  // Never let logging break a guest's chat: the reply already streamed, this is
  // pure analytics. Swallow-and-warn on any store failure.
  try {
    if (usingRealDb) {
      const q = await sql();
      await q`
        INSERT INTO chat_messages (tenant_id, table_no, question, answer)
        VALUES (${turn.tenantId}, ${turn.table}, ${turn.question}, ${turn.answer})`;
      return;
    }
    const rows = await readJson();
    rows.unshift({
      ...turn,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await writeJson(rows);
  } catch (err) {
    console.error("[chat] turn log failed (set DATABASE_URL for durable history)", err);
  }
}

export async function listChatTurns(tenantId: string, limit = 500): Promise<ChatTurnRow[]> {
  if (usingRealDb) {
    const q = await sql();
    const rows = (await q`
      SELECT id, tenant_id, table_no, question, answer, created_at
      FROM chat_messages WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      tenantId: String(r.tenant_id),
      table: String(r.table_no ?? ""),
      question: String(r.question),
      answer: String(r.answer),
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  return (await readJson())
    .filter((r) => r.tenantId === tenantId)
    .slice(0, limit)
    .map((r) => ({ ...r, table: r.table ?? "" }));
}

export async function chatStats(tenantId: string): Promise<{ total: number; today: number }> {
  if (usingRealDb) {
    const q = await sql();
    const [{ total }] = (await q`
      SELECT count(*)::int AS total FROM chat_messages WHERE tenant_id = ${tenantId}`) as {
      total: number;
    }[];
    const [{ today }] = (await q`
      SELECT count(*)::int AS today FROM chat_messages
      WHERE tenant_id = ${tenantId} AND created_at >= date_trunc('day', now())`) as {
      today: number;
    }[];
    return { total, today };
  }
  const rows = (await readJson()).filter((r) => r.tenantId === tenantId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = rows.filter((r) => new Date(r.createdAt) >= start).length;
  return { total: rows.length, today };
}

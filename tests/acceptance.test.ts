// The final acceptance scenario, executed against the REAL persistence path
// (spec §28; hardening pass §2–§5).
//
// This suite exercises the actual store module — src/lib/events/db.ts — not a
// mirror. It drives events through the real attribution rule (attribution.ts),
// the real insert/dedupe/read code (db.ts), and the real in-process realtime bus
// (bus.ts). For ergonomics the authoritative TagIdentity each event resolves
// against is supplied from an in-memory map here — the same fact the write path
// consumes, fed to the same real `attributeTenant`. That the map faithfully
// matches the production owner lookup (getQrByCodeGlobal → qr_codes) is proven
// separately in tests/tag-registry.test.ts, which drives the REAL lookup against
// a real, isolated QR store — so nothing about tag ownership is left assumed.
//
// Persistence track:
//   • default — db.ts's JSON-fallback store (real production code, the
//     zero-config track) in a throwaway ARIES_DATA_DIR. No infrastructure.
//   • opt-in — set TEST_DATABASE_URL to a disposable Postgres/Neon and the exact
//     same tests run against real SQL (db.ts auto-selects on DATABASE_URL). An
//     ambient production DATABASE_URL is deliberately cleared so `npm test` can
//     never touch a real database by accident.
//
// Extensionless internal imports in db.ts resolve via tests/ts-hooks.mjs.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { attributeTenant } from "../src/lib/events/attribution.ts";
import type { TagIdentity } from "../src/lib/events/tags.ts";
import { getBus } from "../src/lib/realtime/bus.ts";
import {
  encodeCursor,
  type NewTapEvent,
  type TapEvent,
  type TapEventType,
} from "../src/lib/events/types.ts";

// —— point the store at a disposable location BEFORE it is imported ——
const DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "aries-accept-"));
process.env.ARIES_DATA_DIR = DATA_DIR;
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; // opt-in real SQL
} else {
  delete process.env.DATABASE_URL; // never touch an ambient prod DB
}
const { insertTapEvent, listActivity, eventsSince, overviewMetrics, usingRealDb } =
  await import("../src/lib/events/db.ts");
import type { TagInfo } from "../src/lib/events/analytics.ts";

before(() => {
  console.log(`[acceptance] persistence track: ${usingRealDb ? "Postgres (TEST_DATABASE_URL)" : "JSON fallback (real db.ts, temp dir)"}`);
});
after(async () => {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
});

// —————————————————————————————— faithful ingest, minus the HTTP edge

// Mirrors the production ingest core exactly: attribute the tenant from the tag
// (never the caller), persist through the real store, and publish only a
// genuinely new row to the tenant's realtime channel.
type Registry = Map<string, TagIdentity>;
async function ingest(
  registry: Registry,
  code: string | null,
  ev: {
    type?: TapEventType;
    sessionId: string;
    idempotencyKey?: string | null;
    claimTenant?: string | null; // a (mis)claimed trusted tenant, to prove it loses
    requireActiveTag?: boolean;
  }
): Promise<{ ok: true; event: TapEvent; created: boolean } | { ok: false; reason: string }> {
  const tag = code ? registry.get(code) ?? null : null;
  const attribution = attributeTenant({
    tag,
    requireActiveTag: ev.requireActiveTag ?? Boolean(code),
    trustedTenant: ev.claimTenant ?? null,
  });
  if (!attribution.ok) return { ok: false, reason: attribution.reason };

  const input: NewTapEvent & { device: string; browser: string; os: string; country: string; city: string } = {
    type: ev.type ?? "NFC_TAP",
    tagCode: tag ? tag.code : code,
    sessionId: ev.sessionId,
    visitorId: null,
    source: "resolver",
    idempotencyKey: ev.idempotencyKey ?? null,
    meta: {},
    device: "", browser: "", os: "", country: "", city: "",
  };
  const { event, created } = await insertTapEvent(attribution.tenantId, input);
  if (created) getBus().publish(event.tenantId, event);
  return { ok: true, event, created };
}

// A dashboard: the tenant-scoped bus subscription an owner's SSE stream opens.
function openDashboard(tenantId: string) {
  const received: TapEvent[] = [];
  const off = getBus().subscribe(tenantId, (e) => received.push(e));
  return { received, close: off };
}

function buildRegistry(specs: { tenantId: string; prefix: string; count: number }[]): Registry {
  const reg: Registry = new Map();
  for (const { tenantId, prefix, count } of specs) {
    for (let i = 1; i <= count; i++) {
      const code = `${prefix}${String(i).padStart(3, "0")}`;
      reg.set(code, { id: `tag-${code}`, tenantId, code, label: `Table ${i}`, status: "ACTIVE" });
    }
  }
  return reg;
}
const tagInfo = (reg: Registry, tenantId: string): TagInfo[] =>
  [...reg.values()].filter((t) => t.tenantId === tenantId).map((t) => ({ code: t.code, label: t.label, isActive: t.status === "ACTIVE" }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// —————————————————————————————— §28 / §2 / §3: concurrent 60-tag scenario

test("§28: concurrent activity across 60 tags — real store — stays tenant-isolated with correct counts", async () => {
  const A = "acc-a", B = "acc-b", C = "acc-c";
  const reg = buildRegistry([
    { tenantId: A, prefix: "AT", count: 20 },
    { tenantId: B, prefix: "BT", count: 20 },
    { tenantId: C, prefix: "CT", count: 20 },
  ]);
  const codes = [...reg.keys()];

  // Owner A has two sessions open; B and C one each.
  const a1 = openDashboard(A), a2 = openDashboard(A), b1 = openDashboard(B), c1 = openDashboard(C);

  // Three taps on every one of the sixty tags, all fired concurrently (§3).
  const TAPS = 3;
  const jobs: Promise<unknown>[] = [];
  for (const code of codes) for (let k = 0; k < TAPS; k++) jobs.push(ingest(reg, code, { sessionId: `s-${code}-${k}` }));
  const results = await Promise.all(jobs);

  // No lost events, none rejected (§3).
  assert.equal(results.length, 60 * TAPS);
  assert.equal(results.every((r) => (r as { ok: boolean }).ok), true);

  const perTenant = 20 * TAPS;
  // Persisted and tenant-scoped: a query for one tenant returns only its rows,
  // and every row is attributed to the tag's true owner (§2).
  for (const [tenantId, prefix] of [[A, "AT"], [B, "BT"], [C, "CT"]] as const) {
    const { events } = await listActivity(tenantId, { limit: 1000 });
    assert.equal(events.length, perTenant);
    assert.equal(events.every((e) => e.tenantId === tenantId), true);
    assert.equal(events.every((e) => (e.tagCode ?? "").startsWith(prefix)), true);
    // No duplicates in the store.
    assert.equal(new Set(events.map((e) => e.id)).size, perTenant);
  }

  // Realtime isolation: each dashboard saw only its own tenant's events; A's two
  // sessions saw the identical authorized set (§4).
  assert.equal(a1.received.length, perTenant);
  assert.equal(a1.received.every((e) => e.tenantId === A), true);
  assert.equal(b1.received.every((e) => e.tenantId === B), true);
  assert.equal(c1.received.every((e) => e.tenantId === C), true);
  assert.deepEqual(a2.received.map((e) => e.id).sort(), a1.received.map((e) => e.id).sort());

  // Aggregate + tag-level counts from the real aggregation path (§2).
  const ovA = await overviewMetrics(A, tagInfo(reg, A));
  assert.equal(ovA.totalTaps, perTenant);
  assert.equal(ovA.activeTags, 20);
  assert.equal(ovA.topTags.length, 8); // top slice
  assert.equal(ovA.topTags.every((t) => t.taps === TAPS), true); // every tag tapped 3×

  a1.close(); a2.close(); b1.close(); c1.close();
});

// —————————————————————————————— §2 / §24: idempotent dedupe never inflates

test("§24: duplicate/idempotent requests do not inflate counts — real store", async () => {
  const T = "acc-dedupe";
  const reg = buildRegistry([{ tenantId: T, prefix: "DT", count: 1 }]);
  const dash = openDashboard(T);
  const key = "nfc:dupe:DT001";

  const first = await ingest(reg, "DT001", { sessionId: "dsess", idempotencyKey: key });
  const retry = await ingest(reg, "DT001", { sessionId: "dsess", idempotencyKey: key });

  assert.equal(first.ok && first.created, true);
  assert.equal(retry.ok && retry.created, false);
  assert.equal(first.ok && retry.ok && first.event.id === retry.event.id, true);

  const { events } = await listActivity(T, { limit: 100 });
  assert.equal(events.length, 1); // one row, not two
  assert.equal(dash.received.length, 1); // notified once
  dash.close();
});

// —————————————————————————————— §2: disabled and revoked tags mint nothing

test("§20: disabled and revoked tags generate no normal events — real store untouched", async () => {
  const T = "acc-lifecycle";
  const reg = buildRegistry([{ tenantId: T, prefix: "LT", count: 2 }]);
  reg.set("LT001", { ...reg.get("LT001")!, status: "DISABLED" });
  reg.set("LT002", { ...reg.get("LT002")!, status: "REVOKED" });
  const dash = openDashboard(T);

  const disabled = await ingest(reg, "LT001", { sessionId: "x", requireActiveTag: true });
  const revoked = await ingest(reg, "LT002", { sessionId: "y", requireActiveTag: true });

  assert.equal(!disabled.ok && disabled.reason, "tag_disabled");
  assert.equal(!revoked.ok && revoked.reason, "tag_revoked");

  const { events } = await listActivity(T, { limit: 100 });
  assert.equal(events.length, 0); // nothing persisted
  assert.equal(dash.received.length, 0); // nothing delivered
  dash.close();
});

// —————————————————————————————— §2: historical ownership is immutable

test("§20: historical events retain original ownership when a code is reassigned — real store", async () => {
  const A = "acc-hist-a", C = "acc-hist-c";
  const reg = buildRegistry([{ tenantId: A, prefix: "HT", count: 1 }]); // HT001 owned by A

  await ingest(reg, "HT001", { sessionId: "h1" });
  await ingest(reg, "HT001", { sessionId: "h2" });

  // The physical tag is retired at A and its code later reused by C — internally
  // a new identity for a different owner. (In production the old row is REVOKED
  // and a new row minted; here we just repoint the code.)
  reg.set("HT001", { id: "tag-HT001-c", tenantId: C, code: "HT001", label: "New", status: "ACTIVE" });
  await ingest(reg, "HT001", { sessionId: "h3" });

  const aEvents = (await listActivity(A, { limit: 100 })).events;
  const cEvents = (await listActivity(C, { limit: 100 })).events;

  // A keeps its two historical HT001 events; they were NOT rewritten to C.
  assert.equal(aEvents.length, 2);
  assert.equal(aEvents.every((e) => e.tenantId === A && e.tagCode === "HT001"), true);
  // C owns only the post-reassignment event.
  assert.equal(cEvents.length, 1);
  assert.equal(cEvents[0].tenantId, C);
  // No A event id leaked into C's history.
  const aIds = new Set(aEvents.map((e) => e.id));
  assert.equal(cEvents.some((e) => aIds.has(e.id)), false);
});

// —————————————————————————————— §5: reconnect / replay (real store)

test("§5: reconnect recovers exactly the missed events with no duplicates — real store", async () => {
  const T = "acc-reconnect";
  const reg = buildRegistry([{ tenantId: T, prefix: "RT", count: 5 }]);
  const codes = [...reg.keys()];

  // 1–2. Connect and receive some events live.
  const live = openDashboard(T);
  for (let i = 0; i < 4; i++) await ingest(reg, codes[i % codes.length], { sessionId: `live-${i}` });
  assert.equal(live.received.length, 4);

  // The dashboard's Last-Event-ID is the newest cursor it holds.
  const feed = (await listActivity(T, { limit: 100 })).events;
  const cursor = encodeCursor(feed[0].createdAt, feed[0].id);
  const seenIds = new Set(feed.map((e) => e.id));

  // 3. Disconnect.
  live.close();
  await sleep(5); // the offline burst is unambiguously later

  // 4. Several events happen while offline.
  const offline: string[] = [];
  for (let i = 0; i < 12; i++) {
    const r = await ingest(reg, codes[i % codes.length], { sessionId: `off-${i}` });
    if (r.ok) offline.push(r.event.id);
  }

  // 5–7. Reconnect: replay from the cursor. Exactly the missed events, ascending
  // by authoritative cursor order, with no duplicates and nothing already seen.
  const missed = await eventsSince(T, cursor);
  assert.equal(missed.length, 12);
  assert.deepEqual(missed.map((e) => e.id).sort(), [...offline].sort());
  assert.equal(missed.some((e) => seenIds.has(e.id)), false);
  for (let i = 1; i < missed.length; i++) {
    assert.ok(encodeCursor(missed[i - 1].createdAt, missed[i - 1].id) < encodeCursor(missed[i].createdAt, missed[i].id));
  }

  // 8. A refresh reconstructs authoritative state, and counters equal the store.
  const afterFeed = (await listActivity(T, { limit: 100 })).events;
  assert.equal(afterFeed.length, 16); // 4 + 12, no duplication
  const ov = await overviewMetrics(T, tagInfo(reg, T));
  assert.equal(ov.totalTaps, afterFeed.filter((e) => e.type === "NFC_TAP").length);
});

// —————————————————————————————— §4: realtime isolation (exact scenario)

test("§4: A1/A2/B1/C1 receive only their tenant's events (A001/A002/B001/C001)", async () => {
  const A = "rt-a", B = "rt-b", C = "rt-c";
  const reg = buildRegistry([
    { tenantId: A, prefix: "A", count: 2 }, // A001, A002
    { tenantId: B, prefix: "B", count: 1 }, // B001
    { tenantId: C, prefix: "C", count: 1 }, // C001
  ]);

  const a1 = openDashboard(A), a2 = openDashboard(A), b1 = openDashboard(B), c1 = openDashboard(C);

  await ingest(reg, "A001", { sessionId: "e1" });
  await ingest(reg, "A002", { sessionId: "e2" });
  await ingest(reg, "B001", { sessionId: "e3" });
  await ingest(reg, "C001", { sessionId: "e4" });

  const codesOf = (d: { received: TapEvent[] }) => d.received.map((e) => e.tagCode).sort();
  assert.deepEqual(codesOf(a1), ["A001", "A002"]);
  assert.deepEqual(codesOf(a2), ["A001", "A002"]);
  assert.deepEqual(codesOf(b1), ["B001"]);
  assert.deepEqual(codesOf(c1), ["C001"]);

  a1.close(); a2.close(); b1.close(); c1.close();
});

// —————————————————————————————— §7: security — forged identifiers can't cross tenants

test("§7: a forged/claimed tenant cannot override tag ownership — real store", async () => {
  const A = "sec-a", B = "sec-b";
  const reg = buildRegistry([{ tenantId: B, prefix: "ST", count: 1 }]); // ST001 belongs to B
  const aDash = openDashboard(A), bDash = openDashboard(B);

  // Present B's tag while claiming A as the trusted tenant, the way a forged
  // request would. It must land under B — the tag's real owner.
  const r = await ingest(reg, "ST001", { sessionId: "forged", claimTenant: A, requireActiveTag: true });
  assert.equal(r.ok && r.event.tenantId, B);

  // Delivered to B only.
  assert.equal(aDash.received.some((e) => e.sessionId === "forged"), false);
  assert.equal(bDash.received.some((e) => e.sessionId === "forged"), true);
  aDash.close(); bDash.close();
});

test("§7: tenant-scoped reads never leak another tenant's events or analytics — real store", async () => {
  const A = "sec-read-a", B = "sec-read-b";
  const reg = buildRegistry([
    { tenantId: A, prefix: "PA", count: 1 },
    { tenantId: B, prefix: "PB", count: 1 },
  ]);
  const a = await ingest(reg, "PA001", { sessionId: "ra" });
  await ingest(reg, "PB001", { sessionId: "rb" });
  assert.equal(a.ok, true);

  // A's feed/analytics contain only A; presenting A's event cursor to B's resync
  // recovers only B's own newer events — never A's row.
  const aFeed = (await listActivity(A, { limit: 100 })).events;
  const bFeed = (await listActivity(B, { limit: 100 })).events;
  assert.equal(aFeed.every((e) => e.tenantId === A), true);
  assert.equal(bFeed.every((e) => e.tenantId === B), true);

  const aCursor = a.ok ? encodeCursor(a.event.createdAt, a.event.id) : "";
  const crossReplay = await eventsSince(B, aCursor);
  assert.equal(crossReplay.some((e) => e.tenantId === A), false);

  const ovB = await overviewMetrics(B, tagInfo(reg, B));
  assert.equal(ovB.totalTaps, bFeed.filter((e) => e.type === "NFC_TAP").length);
  // B's analytics never counted A's tap.
  assert.equal(ovB.topTags.some((t) => t.code.startsWith("PA")), false);
});

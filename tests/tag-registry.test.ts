// The REAL tag-owner lookup, exercised (spec hardening §4).
//
// The acceptance suite feeds attribution from an in-memory TagIdentity map for
// ergonomics. This file removes any doubt that the map faithfully represents
// production by driving the ACTUAL lookup — src/lib/events/tag-registry.ts
// `resolveTagOwner` → src/lib/qr/db.ts `getQrByCodeGlobal` → the tag lifecycle
// mapping — against a REAL, isolated QR store, and chaining it into the real
// attribution rule and the real event store.
//
// Loading the real path needs two things the raw Node runner lacks, both
// test-only and neither a production change:
//   • the `@/` alias + a stub for @/lib/content (its binary image imports don't
//     load headless) — provided by tests/ts-hooks.mjs, and
//   • an isolated data directory: qr/db.ts's JSON fallback writes to os.tmpdir()
//     under NODE_ENV=production, so we point TMPDIR (and the events store's
//     ARIES_DATA_DIR) at one throwaway dir. Production is untouched.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { attributeTenant } from "../src/lib/events/attribution.ts";

// —— isolate the real stores BEFORE importing them ——
const DIR = await fs.mkdtemp(path.join(os.tmpdir(), "aries-tagreg-"));
process.env.NODE_ENV = "production"; // qr/db.ts JSON fallback → os.tmpdir()
process.env.TMPDIR = DIR; //            → our throwaway dir
process.env.ARIES_DATA_DIR = DIR; //   events store → same throwaway dir
delete process.env.DATABASE_URL; //    JSON track, never a real DB

// Seed the real QR registry exactly as the app's tables would hold it: codes are
// globally unique and each carries its owning tenant and lifecycle columns.
const qrRow = (o: Partial<Record<string, unknown>> & { code: string; tenantId: string }) => ({
  id: `id-${o.code}`,
  destinationUrl: "https://example.test",
  label: o.code,
  isActive: true,
  scanCount: 0,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...o,
});
await fs.writeFile(
  path.join(DIR, "qr_codes.json"),
  JSON.stringify([
    qrRow({ code: "AT001", tenantId: "rest-a" }),
    qrRow({ code: "AT002", tenantId: "rest-a" }),
    qrRow({ code: "BT001", tenantId: "rest-b" }),
    qrRow({ code: "CT001", tenantId: "rest-c" }),
    qrRow({ code: "LT001", tenantId: "rest-a", isActive: false }), // DISABLED
    qrRow({ code: "LT002", tenantId: "rest-a", archivedAt: "2026-02-01T00:00:00.000Z" }), // REVOKED
  ])
);

const { resolveTagOwner } = await import("../src/lib/events/tag-registry.ts");
const { insertTapEvent, listActivity } = await import("../src/lib/events/db.ts");

after(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
});

// —————————————————————————————— the real lookup

test("real resolveTagOwner returns the authoritative owner and lifecycle per code", async () => {
  const at001 = await resolveTagOwner("AT001");
  assert.equal(at001?.tenantId, "rest-a");
  assert.equal(at001?.status, "ACTIVE");
  assert.equal(at001?.code, "AT001");
  assert.equal(at001?.id, "id-AT001"); // immutable identity carried through

  assert.equal((await resolveTagOwner("BT001"))?.tenantId, "rest-b"); // different owner
  assert.equal((await resolveTagOwner("CT001"))?.tenantId, "rest-c");
  assert.equal((await resolveTagOwner("LT001"))?.status, "DISABLED");
  assert.equal((await resolveTagOwner("LT002"))?.status, "REVOKED");
  assert.equal(await resolveTagOwner("ZZ999"), null); // unknown code
});

// —————————————————————————————— the real lookup driving attribution

test("real ownership determines the tenant; a claimed tenant cannot override it", async () => {
  // Present rest-a's tag while claiming rest-b — the real owner must win.
  const tag = await resolveTagOwner("AT001");
  const attr = attributeTenant({ tag, requireActiveTag: true, trustedTenant: "rest-b" });
  assert.equal(attr.ok && attr.tenantId, "rest-a");
});

test("real disabled/revoked tags are refused by attribution", async () => {
  assert.deepEqual(
    attributeTenant({ tag: await resolveTagOwner("LT001"), requireActiveTag: true }),
    { ok: false, reason: "tag_disabled" }
  );
  assert.deepEqual(
    attributeTenant({ tag: await resolveTagOwner("LT002"), requireActiveTag: true }),
    { ok: false, reason: "tag_revoked" }
  );
});

// —————————————————————————————— full real chain: lookup → attribute → persist

test("the full real path persists an event under the tag's true owner", async () => {
  const tag = await resolveTagOwner("BT001"); // owned by rest-b
  const attr = attributeTenant({ tag, requireActiveTag: true, trustedTenant: "rest-a" }); // forged claim
  assert.equal(attr.ok, true);
  if (!attr.ok) return;

  await insertTapEvent(attr.tenantId, {
    type: "NFC_TAP",
    tagCode: tag!.code,
    sessionId: "real-chain",
    visitorId: null,
    source: "resolver",
    idempotencyKey: null,
    meta: {},
    device: "", browser: "", os: "", country: "", city: "",
  });

  // Filed under rest-b (the owner), not rest-a (the claim).
  const b = await listActivity("rest-b", { limit: 100 });
  const a = await listActivity("rest-a", { limit: 100 });
  assert.equal(b.events.length, 1);
  assert.equal(b.events[0].tenantId, "rest-b");
  assert.equal(b.events[0].tagCode, "BT001");
  assert.equal(a.events.length, 0);
});

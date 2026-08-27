// Fail-closed production guards (sprint P5/P9/P10).
//
// Insecure development defaults must never silently become production behavior.
// This file runs with NODE_ENV=production and the relevant secrets unset, and
// asserts the system refuses rather than downgrades:
//   • the ephemeral per-instance JSON event store is refused (a missing
//     DATABASE_URL fails loudly instead of losing events on tmpfs), and
//   • signing session/admin cookies with the public dev key is refused.
// Both guards fire only at request time, so `next build` (which also runs as
// NODE_ENV=production) is unaffected. Set BEFORE importing the modules under test.

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
delete process.env.DATABASE_URL;
delete process.env.ARIES_DATA_DIR;
delete process.env.WIFI_SESSION_SECRET;

const { insertTapEvent, listActivity, eventsSince, overviewMetrics } = await import(
  "../src/lib/events/db.ts"
);
const { signToken, verifyToken } = await import("../src/lib/wifi/session.ts");

const minimalInput = {
  type: "NFC_TAP" as const,
  tagCode: "AT001",
  sessionId: "s",
  visitorId: null,
  source: "resolver" as const,
  idempotencyKey: null,
  meta: {},
  device: "", browser: "", os: "", country: "", city: "",
};

test("P9: production refuses the ephemeral JSON event store (no DATABASE_URL)", async () => {
  await assert.rejects(() => insertTapEvent("t", minimalInput), /refusing the ephemeral/i);
  await assert.rejects(() => listActivity("t", { limit: 10 }), /refusing the ephemeral/i);
  await assert.rejects(() => eventsSince("t", null), /refusing the ephemeral/i);
  await assert.rejects(() => overviewMetrics("t", []), /refusing the ephemeral/i);
});

test("P10: production refuses to sign cookies with the insecure dev key", async () => {
  await assert.rejects(() => signToken({ kind: "admin", tenantId: "t" }, 60), /WIFI_SESSION_SECRET/);
  // verifyToken swallows the same error and denies — fail closed, never a crash.
  assert.equal(await verifyToken("header.signature"), null);
});

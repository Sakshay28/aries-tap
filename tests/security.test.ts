// Session-forgery resistance for the owner dashboard's tenant claim (spec §7).
//
// A dashboard read/subscribe is authorized by resolveOwnerTenant, which trusts
// ONLY the tenantId inside a *verified* admin cookie (src/lib/events/tenant.ts).
// So the question "can an attacker forge a tenantId / businessId to read another
// restaurant's data?" reduces to "can they mint a signed cookie they don't hold
// the secret for?" — which is exactly what the HMAC token layer must prevent.
//
// These test that real primitive (src/lib/wifi/session.ts) directly: a genuine
// server-signed session verifies; a self-authored payload, a tampered payload,
// and an expired session are all rejected — so a forged tenant claim never
// resolves to a tenant, and the dashboard routes 401 it. wifi/session.ts has no
// content/alias imports, so it loads in the raw test runner as-is.

import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "../src/lib/wifi/session.ts";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

test("§7: a genuine server-signed admin session verifies and carries its tenant", async () => {
  const token = await signToken({ kind: "admin", tenantId: "restaurant-a" }, 3600);
  const payload = await verifyToken<{ kind?: string; tenantId?: string }>(token);
  assert.equal(payload?.kind, "admin");
  assert.equal(payload?.tenantId, "restaurant-a");
});

test("§7: a self-authored cookie claiming admin + another tenant is rejected (no valid signature)", async () => {
  // The attacker writes their own payload but cannot produce the HMAC.
  const body = b64url(JSON.stringify({ kind: "admin", tenantId: "restaurant-b", exp: Date.now() + 3600_000 }));
  const forged = `${body}.${b64url("not-a-real-signature")}`;
  assert.equal(await verifyToken(forged), null);
});

test("§7: tampering with a valid token's tenant claim invalidates it", async () => {
  const token = await signToken({ kind: "admin", tenantId: "restaurant-a" }, 3600);
  const [, sig] = token.split(".");
  // Swap in a different tenant while keeping the original signature.
  const tamperedBody = b64url(JSON.stringify({ kind: "admin", tenantId: "restaurant-b", exp: Date.now() + 3600_000 }));
  assert.equal(await verifyToken(`${tamperedBody}.${sig}`), null);
});

test("§7: an expired admin session is rejected", async () => {
  const token = await signToken({ kind: "admin", tenantId: "restaurant-a" }, -1); // already expired
  assert.equal(await verifyToken(token), null);
});

test("§7: garbage and empty tokens are rejected", async () => {
  assert.equal(await verifyToken(undefined), null);
  assert.equal(await verifyToken(""), null);
  assert.equal(await verifyToken("no-dot"), null);
  assert.equal(await verifyToken("a.b.c"), null);
});

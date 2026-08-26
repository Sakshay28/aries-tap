// Cross-tenant safety, as executable proof (spec §20, §21, §22).
//
// These pin down the two pure decisions the whole isolation story rests on — how
// a tag's lifecycle is read, and who an event is attributed to — plus the
// realtime bus's tenant fan-out. All three run with no database and no network:
// the attribution rule and the bus are deliberately pure so the guarantees can
// be checked directly here (and so they can never quietly regress). Zero deps —
// run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";

import { tagStatus, type TagIdentity } from "../src/lib/events/tags.ts";
import { attributeTenant } from "../src/lib/events/attribution.ts";
import { getBus } from "../src/lib/realtime/bus.ts";
import type { TapEvent } from "../src/lib/events/types.ts";

// —————————————————————————————— fixtures

function tag(partial: Partial<TagIdentity> & { tenantId: string; code: string }): TagIdentity {
  return {
    id: `tag-${partial.code}`,
    label: "",
    status: "ACTIVE",
    ...partial,
  };
}

let seq = 0;
function ev(tenantId: string, tagCode: string | null): TapEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    tenantId,
    type: "NFC_TAP",
    tagCode,
    sessionId: "s",
    visitorId: null,
    rating: null,
    meta: {},
    source: "resolver",
    device: "",
    browser: "",
    os: "",
    country: "",
    city: "",
    createdAt: new Date().toISOString(),
  };
}

// —————————————————————————————— §20 tag lifecycle mapping

test("tagStatus maps the three lifecycle states (revoked beats disabled)", () => {
  assert.equal(tagStatus({ isActive: true, archivedAt: null }), "ACTIVE");
  assert.equal(tagStatus({ isActive: false, archivedAt: null }), "DISABLED");
  assert.equal(tagStatus({ isActive: true, archivedAt: "2026-01-01T00:00:00Z" }), "REVOKED");
  // Archived always reads as REVOKED even if the active flag was never cleared.
  assert.equal(tagStatus({ isActive: false, archivedAt: "2026-01-01T00:00:00Z" }), "REVOKED");
});

// —————————————————————————————— §20/§21 attribution

test("an active tag attributes to its owner", () => {
  const a = attributeTenant({ tag: tag({ tenantId: "restaurant-a", code: "AT001" }) });
  assert.deepEqual(a, { ok: true, tenantId: "restaurant-a", tagId: "tag-AT001" });
});

test("§21: a tag's owner wins over any claimed tenant", () => {
  // The attacker presents Restaurant A's tag but asserts Restaurant B as the
  // trusted tenant. The event must still land under A — the tag's real owner —
  // never under B. This is the core cross-tenant-write defense.
  const a = attributeTenant({
    tag: tag({ tenantId: "restaurant-a", code: "AT001" }),
    trustedTenant: "restaurant-b",
    requireActiveTag: true,
  });
  assert.equal(a.ok, true);
  assert.equal(a.ok && a.tenantId, "restaurant-a");
});

test("§20: a disabled tag mints nothing", () => {
  const a = attributeTenant({
    tag: tag({ tenantId: "restaurant-a", code: "AT001", status: "DISABLED" }),
    requireActiveTag: true,
  });
  assert.deepEqual(a, { ok: false, reason: "tag_disabled" });
});

test("§20: a revoked tag mints nothing", () => {
  const a = attributeTenant({
    tag: tag({ tenantId: "restaurant-a", code: "AT001", status: "REVOKED" }),
    requireActiveTag: true,
  });
  assert.deepEqual(a, { ok: false, reason: "tag_revoked" });
});

test("a required-tag event with no known tag is refused", () => {
  assert.deepEqual(
    attributeTenant({ tag: null, requireActiveTag: true, trustedTenant: "restaurant-a" }),
    { ok: false, reason: "unknown_tag" }
  );
});

test("a page-level event falls back to the trusted tenant, but never to nothing", () => {
  assert.deepEqual(attributeTenant({ tag: null, trustedTenant: "restaurant-a" }), {
    ok: true,
    tenantId: "restaurant-a",
    tagId: null,
  });
  assert.deepEqual(attributeTenant({ tag: null }), { ok: false, reason: "no_tenant" });
});

// —————————————————————————————— §22 realtime bus isolation

test("§22: the bus fans an event out only to its own tenant's subscribers", () => {
  const bus = getBus();
  const A = "iso-restaurant-a";
  const B = "iso-restaurant-b";

  const a1: TapEvent[] = [];
  const a2: TapEvent[] = [];
  const b1: TapEvent[] = [];

  // Two dashboards for A, one for B — the spec's A1/A2/B1 shape.
  const offA1 = bus.subscribe(A, (e) => a1.push(e));
  const offA2 = bus.subscribe(A, (e) => a2.push(e));
  const offB1 = bus.subscribe(B, (e) => b1.push(e));

  const aTap = ev(A, "AT001");
  const bTap = ev(B, "BT001");
  bus.publish(A, aTap);
  bus.publish(B, bTap);

  // Both of A's dashboards see A's event; B's sees none of it.
  assert.deepEqual(a1.map((e) => e.id), [aTap.id]);
  assert.deepEqual(a2.map((e) => e.id), [aTap.id]);
  assert.equal(b1.some((e) => e.id === aTap.id), false);
  // B's dashboard sees only B's event.
  assert.deepEqual(b1.map((e) => e.id), [bTap.id]);

  offA1();
  offA2();
  offB1();

  // After unsubscribe, no further delivery — and no leak to a stale handler.
  bus.publish(A, ev(A, "AT002"));
  assert.equal(a1.length, 1);
});

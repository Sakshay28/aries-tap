// The managed realtime adapter (Ably), exercised against a mocked broker
// boundary — the multi-instance production transport (spec §27; sprint P1).
//
// No credentials and no network: AblyBus takes an injectable client, so a fake
// in-memory broker stands in for Ably. What's under test is everything the
// adapter is responsible for — tenant-scoped channel naming, that a publish
// reaches only its tenant's channel, that a subscriber receives only its own
// tenant's events, that unsubscribe stops delivery, and that a broker failure is
// swallowed rather than propagated into the write path. The one thing that
// genuinely needs real Ably credentials (an end-to-end publish across two
// processes) is called out in docs/PRODUCTION-VERIFICATION.md.

import { test } from "node:test";
import assert from "node:assert/strict";

import { AblyBus, tenantChannel } from "../src/lib/realtime/ably.ts";
import type { TapEvent } from "../src/lib/events/types.ts";

// —— a fake broker: one shared channel registry behind both rest & realtime ——
function makeBroker() {
  const subs = new Map<string, Set<(msg: { data: unknown }) => void>>();
  const published: { channel: string; name: string; data: unknown }[] = [];
  let fail = false;
  const client = {
    channels: {
      get(channel: string) {
        return {
          async publish(name: string, data: unknown) {
            if (fail) throw new Error("broker unavailable");
            published.push({ channel, name, data });
            for (const l of [...(subs.get(channel) ?? [])]) l({ data });
          },
          subscribe(_name: string, listener: (msg: { data: unknown }) => void) {
            let set = subs.get(channel);
            if (!set) subs.set(channel, (set = new Set()));
            set.add(listener);
          },
          unsubscribe(_name: string, listener: (msg: { data: unknown }) => void) {
            subs.get(channel)?.delete(listener);
          },
        };
      },
    },
  };
  return { client, published, setFail: (v: boolean) => (fail = v) };
}

const busWith = (broker: ReturnType<typeof makeBroker>) =>
  new AblyBus({ rest: broker.client, realtime: broker.client });

// subscribe() attaches on a microtask; let it settle before publishing.
const settle = () => new Promise((r) => setTimeout(r, 0));

let seq = 0;
function ev(tenantId: string, code: string): TapEvent {
  seq += 1;
  return {
    id: `e${seq}`, tenantId, type: "NFC_TAP", tagCode: code, sessionId: "s",
    visitorId: null, rating: null, meta: {}, source: "resolver",
    device: "", browser: "", os: "", country: "", city: "",
    createdAt: new Date().toISOString(),
  };
}

// —————————————————————————————— channel naming / tenant scoping

test("P1: channel name is derived from the tenant and sanitized", () => {
  assert.equal(tenantChannel("rest-a"), "tap:rest-a");
  assert.equal(tenantChannel("taffeta"), "tap:taffeta");
  // A surprising value can never produce a malformed or cross-tenant channel:
  // the result stays within a safe, bounded alphabet with no path/wildcard chars.
  const weird = tenantChannel("a/../b *");
  assert.match(weird, /^tap:[A-Za-z0-9_-]+$/);
  assert.equal(/[./ *]/.test(weird), false);
  assert.equal(tenantChannel(""), "tap:unknown");
  assert.equal(tenantChannel("x".repeat(500)).length <= "tap:".length + 80, true);
  assert.notEqual(tenantChannel("rest-a"), tenantChannel("rest-b"));
});

// —————————————————————————————— publish routes to the tenant's channel

test("P1: publish goes to exactly the tenant's channel with the event payload", async () => {
  const broker = makeBroker();
  const bus = busWith(broker);
  const event = ev("rest-a", "AT001");
  await bus.publish("rest-a", event);

  assert.equal(broker.published.length, 1);
  assert.equal(broker.published[0].channel, "tap:rest-a");
  assert.equal(broker.published[0].name, "tap");
  assert.equal((broker.published[0].data as TapEvent).id, event.id);
});

// —————————————————————————————— subscriber isolation

test("P1: a subscriber receives only its own tenant's events", async () => {
  const broker = makeBroker();
  const bus = busWith(broker);
  const a: TapEvent[] = [];
  const b: TapEvent[] = [];

  const offA = bus.subscribe("rest-a", (e) => a.push(e));
  const offB = bus.subscribe("rest-b", (e) => b.push(e));
  await settle(); // let both attach

  await bus.publish("rest-a", ev("rest-a", "AT001"));
  await bus.publish("rest-b", ev("rest-b", "BT001"));

  assert.equal(a.length, 1);
  assert.equal(a[0].tenantId, "rest-a");
  assert.equal(b.length, 1);
  assert.equal(b[0].tenantId, "rest-b");
  assert.equal(a.some((e) => e.tenantId === "rest-b"), false);

  offA();
  offB();
  // After unsubscribe, no further delivery.
  await bus.publish("rest-a", ev("rest-a", "AT002"));
  assert.equal(a.length, 1);
});

// —————————————————————————————— failure handling

test("P1: a broker publish failure is swallowed, never thrown into the write path", async () => {
  const broker = makeBroker();
  const bus = busWith(broker);
  broker.setFail(true);
  // Must resolve (not reject): persistence already happened; publish is best-effort.
  await assert.doesNotReject(() => Promise.resolve(bus.publish("rest-a", ev("rest-a", "AT001"))));
  assert.equal(broker.published.length, 0);
});

test("P1: unsubscribing before attach completes never delivers", async () => {
  const broker = makeBroker();
  const bus = busWith(broker);
  const got: TapEvent[] = [];
  const off = bus.subscribe("rest-a", (e) => got.push(e));
  off(); // cancel before the microtask attach runs
  await settle();
  await bus.publish("rest-a", ev("rest-a", "AT001"));
  assert.equal(got.length, 0);
});

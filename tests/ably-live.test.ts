// The one thing the mocked adapter test (ably.test.ts) cannot prove: a real
// end-to-end publish fanning out across two INDEPENDENT Ably connections — the
// production shape where instance #2 ingests a tap and instance #1's dashboard,
// on a different process, receives it live. This is the automation of
// docs/PRODUCTION-VERIFICATION.md §B, runnable with one command.
//
// Credential-gated: it self-skips unless ABLY_API_KEY is set, so `npm test`
// stays hermetic and offline. To run it against real Ably:
//
//     ABLY_API_KEY=xxxx:yyyy \
//       node --experimental-strip-types --import ./tests/register-hooks.mjs \
//       --test tests/ably-live.test.ts
//
// It publishes over REST from one AblyBus and subscribes over Realtime from a
// second AblyBus built on a SEPARATE connection, so the fan-out genuinely
// crosses the broker rather than staying in one client — the property a single
// process can otherwise never demonstrate. Channels are stamped per run so
// concurrent runs never cross-talk.

import { test } from "node:test";
import assert from "node:assert/strict";

import { AblyBus, type AblyClientLike } from "../src/lib/realtime/ably.ts";
import type { TapEvent } from "../src/lib/events/types.ts";

const KEY = process.env.ABLY_API_KEY;
const skip = KEY ? false : "set ABLY_API_KEY to run the live Ably fan-out test";

// The slice of a real Ably.Realtime we touch for connection lifecycle. Declared
// locally so the SDK's types never enter the build graph.
interface AblyConnectionLike {
  state?: string;
  once(event: string, listener: () => void): void;
}
interface AblyRealtimeRaw extends AblyClientLike {
  connection?: AblyConnectionLike;
  close?(): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Resolve once the realtime connection is up, so a publish can't race ahead of
// the connection being established. Falls through on a safety timeout.
function waitConnected(client: AblyRealtimeRaw): Promise<void> {
  const conn = client.connection;
  if (!conn || conn.state === "connected") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    conn.once("connected", finish);
    setTimeout(finish, 8000);
  });
}

let seq = 0;
function ev(tenantId: string, code: string): TapEvent {
  seq += 1;
  return {
    id: `live-e${seq}`, tenantId, type: "NFC_TAP", tagCode: code, sessionId: "s",
    visitorId: null, rating: null, meta: {}, source: "resolver",
    device: "", browser: "", os: "", country: "", city: "",
    createdAt: new Date().toISOString(),
  };
}

test("live: a real Ably publish fans out cross-connection to the right tenant only", { skip }, async () => {
  const Ably = await import("ably");
  const restClient = new Ably.Rest(KEY as string) as unknown as AblyClientLike;
  const realtimeClient = new Ably.Realtime(KEY as string) as unknown as AblyRealtimeRaw;

  // Two buses on two connections: the publisher stands in for the ingest
  // instance, the subscriber for a dashboard instance on a different process.
  const publisher = new AblyBus({ rest: restClient });
  const subscriber = new AblyBus({ realtime: realtimeClient });

  const stamp = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const tenantA = `live-a-${stamp}`;
  const tenantB = `live-b-${stamp}`;
  const gotA: TapEvent[] = [];
  const gotB: TapEvent[] = [];

  const offA = subscriber.subscribe(tenantA, (e) => gotA.push(e));
  const offB = subscriber.subscribe(tenantB, (e) => gotB.push(e));

  try {
    await waitConnected(realtimeClient);

    // Poll-publish to tenant A until it lands, so a channel-attach race can't
    // flake the assertion. Real fan-out is sub-second; the deadline is slack.
    const event = ev(tenantA, "AT001");
    const deadline = Date.now() + 15000;
    while (gotA.length === 0 && Date.now() < deadline) {
      await publisher.publish(tenantA, event);
      await sleep(750);
    }
    // A brief settle so any *wrongly* delivered tenant-B message would arrive
    // before we assert isolation.
    await sleep(500);

    assert.ok(gotA.length >= 1, "subscriber received the tenant-A event over real Ably");
    assert.equal(gotA[0].tenantId, tenantA);
    assert.equal(gotA[0].id, event.id);
    assert.equal(gotB.length, 0, "the other tenant's channel received nothing");
  } finally {
    offA();
    offB();
    try {
      realtimeClient.close?.();
    } catch {
      /* tearing down anyway */
    }
    const rest = restClient as unknown as { close?(): void };
    try {
      rest.close?.();
    } catch {
      /* rest holds no persistent connection */
    }
  }
});

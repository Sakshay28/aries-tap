// The managed realtime adapter — the multi-instance production path (spec §27's
// "optional managed pub/sub adapter for horizontal scaling").
//
// The in-process bus (bus.ts) fans events out only within one Node process, so
// on a horizontally-scaled deployment a tap ingested by instance #2 would never
// reach a dashboard streaming from instance #1. This adapter closes that gap by
// routing every event through Ably: a write publishes to a tenant-scoped channel
// over REST, and each SSE stream subscribes to that channel over Ably's realtime
// connection, so events fan out across *every* instance.
//
// Invariants it preserves (identical to the in-process bus):
//   • Tenant isolation — the channel name is derived solely from the tenantId the
//     server already resolved (tag owner on writes, signed session on reads). A
//     client cannot name a channel; there is no channel parameter anywhere.
//   • The database stays the source of truth — publish is best-effort and only
//     happens AFTER a successful persist (see ingest.ts). A publish failure is
//     logged and swallowed; it can never corrupt a stored event, and the SSE
//     resync recovers anything the broker dropped on the next (re)connect.
//   • Server-only credentials — ABLY_API_KEY is read here, on the server, and
//     used only to mint server clients. It is NEVER sent to the browser; the
//     browser still speaks only our own SSE endpoint.
//
// The SDK is imported lazily so a local/dev deployment that never sets
// ARIES_REALTIME=ably carries no Ably connection and no extra failure mode. The
// client boundary is injectable so the whole adapter is unit-testable with a
// fake broker, no credentials required.

import type { EventHandler, RealtimeBus } from "./bus";
import type { TapEvent } from "@/lib/events/types";
import { logEvent } from "@/lib/events/log";

const CHANNEL_PREFIX = "tap:";
const EVENT_NAME = "tap";

// One channel per tenant. tenantId is always server-derived, but we still clamp
// it to a safe, bounded channel-name alphabet so a surprising value can never
// produce a malformed or cross-tenant channel.
export function tenantChannel(tenantId: string): string {
  const safe = String(tenantId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return CHANNEL_PREFIX + (safe || "unknown");
}

// Minimal structural shapes of the slice of Ably we use. Declaring them here
// (rather than importing Ably's types) keeps the SDK out of the build graph
// until a channel is actually used, and lets tests inject a fake broker.
export interface AblyChannelLike {
  publish(name: string, data: unknown): Promise<unknown> | void;
  subscribe(name: string, listener: (msg: { data: unknown }) => void): unknown;
  unsubscribe(name: string, listener: (msg: { data: unknown }) => void): void;
}
export interface AblyClientLike {
  channels: { get(name: string): AblyChannelLike };
  close?(): void;
}
export type AblyClients = { rest?: AblyClientLike; realtime?: AblyClientLike };

function requireKey(): string {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error(
      "ARIES_REALTIME=ably requires a server-side ABLY_API_KEY. " +
        "Unset ARIES_REALTIME to use the in-process bus for local development."
    );
  }
  return key;
}

// Eager configuration check, called at bus selection (see bus.ts). A deployment
// that opts into the managed transport but forgets the key should fail loudly
// the first time the bus is used — an SSE connect surfaces a 500, a publish logs
// — rather than silently degrading to a dashboard that only ever shows the
// resync snapshot and no live updates. Constructs no client and loads no SDK.
export function assertAblyConfigured(): void {
  requireKey();
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class AblyBus implements RealtimeBus {
  readonly kind = "ably";
  private rest?: AblyClientLike;
  private realtime?: AblyClientLike;

  // Tests pass fake clients; production leaves this empty and the real Ably REST
  // (publish) and Realtime (subscribe) clients are created lazily on first use.
  constructor(clients?: AblyClients) {
    this.rest = clients?.rest;
    this.realtime = clients?.realtime;
  }

  private async restClient(): Promise<AblyClientLike> {
    if (this.rest) return this.rest;
    const Ably = await import("ably");
    this.rest = new Ably.Rest(requireKey()) as unknown as AblyClientLike;
    return this.rest;
  }

  private async realtimeClient(): Promise<AblyClientLike> {
    if (this.realtime) return this.realtime;
    const Ably = await import("ably");
    this.realtime = new Ably.Realtime(requireKey()) as unknown as AblyClientLike;
    return this.realtime;
  }

  // Best-effort. Persistence already happened; a broker failure is logged and
  // swallowed so it can never break a write or corrupt a stored event. Returns a
  // promise so the caller can attach a .catch, but callers must not depend on it.
  async publish(tenantId: string, event: TapEvent): Promise<void> {
    const channel = tenantChannel(tenantId);
    try {
      const client = await this.restClient();
      await client.channels.get(channel).publish(EVENT_NAME, event);
    } catch (err) {
      logEvent("realtime_publish_error", {
        phase: "publish",
        tenantId,
        eventId: event.id,
        channel,
        message: errMsg(err),
      });
    }
  }

  // Attach is asynchronous (a realtime connection), but the interface returns the
  // unsubscribe synchronously — matching the in-process bus. Any event that lands
  // during attach is covered by the SSE route's database resync and the client's
  // cursor-based reconnect recovery, so the DB — never the socket — remains the
  // source of truth.
  subscribe(tenantId: string, handler: EventHandler): () => void {
    const channel = tenantChannel(tenantId);
    let active = true;
    let bound: AblyChannelLike | undefined;
    const listener = (msg: { data: unknown }) => {
      if (active) handler(msg.data as TapEvent);
    };

    this.realtimeClient()
      .then((client) => {
        if (!active) return; // unsubscribed before attach completed
        bound = client.channels.get(channel);
        void bound.subscribe(EVENT_NAME, listener);
      })
      .catch((err) => {
        logEvent("realtime_publish_error", { phase: "subscribe", tenantId, channel, message: errMsg(err) });
      });

    return () => {
      active = false;
      try {
        bound?.unsubscribe(EVENT_NAME, listener);
      } catch {
        /* detach errors are non-fatal — the connection is being torn down anyway */
      }
    };
  }
}

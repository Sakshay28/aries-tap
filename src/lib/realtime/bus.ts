// The realtime seam. Everything that writes an event publishes it here; the SSE
// route (and any future transport) subscribes here. One small interface, two
// implementations:
//
//   • In-process broker (default, zero config) — a per-tenant fan-out backed by
//     a globalThis singleton so it survives dev HMR. Genuinely event-driven: a
//     write pushes straight to every open SSE stream in the same process. No
//     polling, no timers. Perfect locally and for a single always-warm server
//     or a single serverless instance.
//
//   • Managed adapter (opt-in via ABLY_API_KEY) — publishes over REST and
//     subscribes over the provider's stream, so events fan out across *every*
//     serverless instance. This is the box to tick for multi-instance
//     production scale; see ./ably.ts. Nothing here changes at the call sites.
//
// The database is always the source of truth (see eventsSince() resync), so the
// bus missing a message across a cold instance boundary degrades to "the
// dashboard catches up on its next reconnect", never to wrong data.

import type { TapEvent } from "@/lib/events/types";
import { AblyBus } from "./ably";

export type EventHandler = (event: TapEvent) => void;

export interface RealtimeBus {
  readonly kind: string;
  publish(tenantId: string, event: TapEvent): Promise<void> | void;
  // Returns an unsubscribe fn. Handlers must never throw (the bus guards anyway).
  subscribe(tenantId: string, handler: EventHandler): () => void;
}

// —————————————————————————————— in-process broker

type Registry = Map<string, Set<EventHandler>>;

// Survive HMR and repeated module evaluation within one process.
const g = globalThis as unknown as { __ariesRealtime?: Registry };
function registry(): Registry {
  if (!g.__ariesRealtime) g.__ariesRealtime = new Map();
  return g.__ariesRealtime;
}

class InProcessBus implements RealtimeBus {
  readonly kind = "in-process";

  publish(tenantId: string, event: TapEvent): void {
    const set = registry().get(tenantId);
    if (!set || set.size === 0) return;
    // Copy first: a handler may unsubscribe itself during iteration.
    for (const h of [...set]) {
      try {
        h(event);
      } catch (err) {
        console.error("[realtime] subscriber threw", err);
      }
    }
  }

  subscribe(tenantId: string, handler: EventHandler): () => void {
    const reg = registry();
    let set = reg.get(tenantId);
    if (!set) {
      set = new Set();
      reg.set(tenantId, set);
    }
    set.add(handler);
    return () => {
      const s = reg.get(tenantId);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) reg.delete(tenantId);
    };
  }
}

// —————————————————————————————— selection

const gb = globalThis as unknown as { __ariesBus?: RealtimeBus };

// Which transport backs realtime, chosen once per process from the environment:
//   • unset / "in-process" — the default. Zero config, single-instance/local.
//   • "ably"               — the managed multi-instance adapter (needs a
//                            server-side ABLY_API_KEY; see ./ably.ts).
// AblyBus is constructed eagerly but loads no SDK until a channel is first used,
// so importing this module never pulls Ably into a deployment that isn't using
// it. Selection is explicit (never inferred from a stray credential) so a
// deployment can't silently change transports.
function createBus(): RealtimeBus {
  const mode = (process.env.ARIES_REALTIME || "in-process").trim().toLowerCase();
  if (mode === "ably") return new AblyBus();
  return new InProcessBus();
}

export function getBus(): RealtimeBus {
  if (gb.__ariesBus) return gb.__ariesBus;
  gb.__ariesBus = createBus();
  return gb.__ariesBus;
}

// Convenience used by the ingest pipeline. Publishing must never break a write,
// so it's wrapped and swallowed here rather than at every call site. The managed
// adapter returns a promise; we attach a catch so a rejected publish degrades to
// a logged miss (recovered by the next SSE resync), never an unhandled rejection.
export function publishEvent(event: TapEvent): void {
  try {
    const result = getBus().publish(event.tenantId, event) as unknown;
    if (result && typeof (result as PromiseLike<void>).then === "function") {
      Promise.resolve(result as PromiseLike<void>).catch((err) =>
        console.error("[realtime] publish failed", err)
      );
    }
  } catch (err) {
    console.error("[realtime] publish failed", err);
  }
}

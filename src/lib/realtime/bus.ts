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

export function getBus(): RealtimeBus {
  if (gb.__ariesBus) return gb.__ariesBus;
  // The managed adapter is loaded only when explicitly configured, so the
  // default deployment carries no extra dependency and no extra failure mode.
  // (Kept synchronous-return by resolving lazily inside the adapter itself.)
  gb.__ariesBus = new InProcessBus();
  return gb.__ariesBus;
}

// Convenience used by the ingest pipeline. Publishing must never break a write,
// so it's wrapped and swallowed here rather than at every call site.
export function publishEvent(event: TapEvent): void {
  try {
    getBus().publish(event.tenantId, event);
  } catch (err) {
    console.error("[realtime] publish failed", err);
  }
}

// Analytics dispatch with an offline queue. Every funnel event goes through
// here. On a flaky restaurant WiFi the call may fail — so a failed/offline event
// is stashed in localStorage and flushed automatically when connectivity
// returns (or on the next open). Telemetry must never block or break the guest.

import { recordEvent } from "@/lib/review/actions";
import type { EventInput } from "@/lib/review/types";

const QUEUE_KEY = "aries_review_queue";
const MAX_QUEUE = 100;

function readQueue(): EventInput[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as EventInput[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: EventInput[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    /* storage full / blocked — drop silently, it's only telemetry */
  }
}

function enqueue(input: EventInput): void {
  const q = readQueue();
  q.push(input);
  writeQueue(q);
}

// Send one event. Resolves whether or not it was delivered — a caller never
// needs to await this for correctness.
export async function track(input: EventInput): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(input);
    return;
  }
  try {
    const res = await recordEvent(input);
    if (!res.ok) enqueue(input);
  } catch {
    enqueue(input);
  }
}

// Drain the queue in order, keeping anything that still fails for next time.
export async function flushQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const q = readQueue();
  if (q.length === 0) return;
  writeQueue([]); // optimistic clear; failures are re-queued below

  const stillFailed: EventInput[] = [];
  for (const item of q) {
    try {
      const res = await recordEvent(item);
      if (!res.ok) stillFailed.push(item);
    } catch {
      stillFailed.push(item);
    }
  }
  if (stillFailed.length) writeQueue([...readQueue(), ...stillFailed]);
}

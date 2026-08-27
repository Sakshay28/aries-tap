// The owner dashboard's live wire: a Server-Sent Events stream, scoped to the
// authenticated owner's tenant and gated by the signed admin cookie.
//
// On connect it (1) replays everything the client missed since its last cursor
// straight from the database — so the DB, not the socket, is the source of
// truth — then (2) subscribes to the realtime bus and forwards new events as
// they land. The subscription is keyed by the tenant resolved from the session,
// so a dashboard can only ever receive its own business's events; there is no
// tenant parameter a client could set to widen it (spec §17, §22). A heartbeat
// comment keeps the connection warm and lets the browser notice a dead link. On
// serverless the platform may cap the connection's lifetime; that's fine —
// EventSource reconnects with its Last-Event-ID and the resync closes any gap.

import { after, type NextRequest } from "next/server";
import { resolveOwnerTenant } from "@/lib/events/tenant";
import { eventsSince } from "@/lib/events/db";
import { logEvent } from "@/lib/events/log";
import { getBus } from "@/lib/realtime/bus";
import { encodeCursor, type TapEvent } from "@/lib/events/types";

export const runtime = "nodejs"; // the in-process bus needs shared memory
export const dynamic = "force-dynamic";
export const maxDuration = 300; // platform may cut sooner; client reconnects

const HEARTBEAT_MS = 20_000;

export async function GET(req: NextRequest) {
  const tenantId = await resolveOwnerTenant(req);
  if (!tenantId) {
    logEvent("authz_failure", { route: "dashboard/stream" });
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const url = new URL(req.url);
  // First connect passes ?cursor=; reconnects carry Last-Event-ID automatically.
  const initialCursor =
    req.headers.get("last-event-id") || url.searchParams.get("cursor") || null;

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const frame = (event: TapEvent) =>
        `id: ${encodeCursor(event.createdAt, event.id)}\n` +
        `event: tap\n` +
        `data: ${JSON.stringify(event)}\n\n`;

      // Tell the client it's live (and the retry backoff floor).
      send("retry: 3000\n\n");
      send(`event: ready\ndata: ${JSON.stringify({ tenant: tenantId, at: new Date().toISOString() })}\n\n`);
      logEvent("stream_open", { tenantId, reconnect: Boolean(initialCursor) });

      // (1) Replay the gap from the database, oldest-first.
      try {
        const missed = await eventsSince(tenantId, initialCursor);
        for (const e of missed) send(frame(e));
        logEvent("stream_resync", { tenantId, replayed: missed.length });
      } catch (err) {
        console.error("[dashboard/stream] resync failed", err);
      }

      // (2) Live subscription. The bus pushes synchronously; we just forward.
      // Keyed by this owner's tenant, so cross-tenant events never arrive here.
      unsubscribe = getBus().subscribe(tenantId, (event) => send(frame(event)));

      heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (unsubscribe) unsubscribe();
    logEvent("stream_close", { tenantId });
  }

  // Belt-and-suspenders: release the subscription if the request is aborted.
  req.signal.addEventListener("abort", cleanup);
  after(() => cleanup());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Defeat proxy buffering (nginx) so events aren't held back.
      "X-Accel-Buffering": "no",
    },
  });
}

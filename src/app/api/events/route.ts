// The public event beacon. The landing page posts page-level interactions here
// (a profile view, a CTA click) so they join the same authoritative stream as
// NFC taps and reviews.
//
// This is the one unauthenticated *write* into the event system, so it is the
// most locked-down: only page-level event types are accepted here — NFC taps
// come from the resolver, WhatsApp clicks from the tracked redirect, and review
// events from the server-side bridge, none of which a client can forge through
// this endpoint. It is rate-limited by IP and session, and it never blocks the
// caller: the browser fires it with `keepalive` and ignores the result.

import { NextResponse, type NextRequest } from "next/server";
import { ingestEvent } from "@/lib/events/ingest";
import { DEPLOYMENT_TENANT_ID } from "@/lib/events/tenant";
import { isTapEventType, type NewTapEvent, type TapEventType } from "@/lib/events/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types a public client is allowed to mint. Everything else is server-attributed
// and would let a script inflate taps/reviews if accepted here.
const PUBLIC_TYPES: readonly TapEventType[] = ["PROFILE_VIEW", "CTA_CLICK"];

export async function POST(req: NextRequest) {
  let body: Partial<NewTapEvent>;
  try {
    body = (await req.json()) as Partial<NewTapEvent>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const type = body.type;
  if (!isTapEventType(type) || !PUBLIC_TYPES.includes(type)) {
    return NextResponse.json({ ok: false, error: "Event type not accepted here." }, { status: 422 });
  }

  const result = await ingestEvent(
    {
      type,
      tagCode: typeof body.tagCode === "string" ? body.tagCode : null,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : "",
      visitorId: typeof body.visitorId === "string" ? body.visitorId : null,
      meta: (body.meta as NewTapEvent["meta"]) ?? {},
      source: "client",
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
    },
    req.headers,
    // The beacon is unauthenticated and its only allowed types are page-level,
    // so there is no tag to attribute from — it belongs to the deployment's
    // venue. The tenant is fixed here server-side; a client cannot set it.
    { rateLimit: true, tenantId: DEPLOYMENT_TENANT_ID }
  );

  if (!result.ok) {
    const status = result.retryAfter ? 429 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, deduped: result.deduped });
}

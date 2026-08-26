// Tracked WhatsApp CTA. The landing page links its WhatsApp button here instead
// of straight to wa.me, so every click becomes a first-class event the owner
// dashboard sees live — without ever slowing the guest down.
//
// Two rules from the spec, both load-bearing:
//   1. The redirect must not depend on analytics succeeding. We build the
//      Response first and record the event in `after()`, so a slow or failed
//      write can never delay (or block) the hand-off to WhatsApp.
//   2. The destination is derived entirely server-side from venue config. The
//      client cannot supply the phone number or an arbitrary URL — this route
//      can only ever send a guest to *this* venue's WhatsApp, never an
//      attacker-chosen link.

import { NextResponse, after, type NextRequest } from "next/server";
import { business, location } from "@/lib/content";
import { ingestEvent } from "@/lib/events/ingest";
import { DEPLOYMENT_TENANT_ID } from "@/lib/events/tenant";
import { ANON_COOKIE, newAnonId, setAnonCookie } from "@/lib/events/session";
import { notFoundResponse } from "@/lib/qr/statusPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The venue's WhatsApp number, from config, reduced to E.164 digits. This is the
// only place the destination is decided.
function venueWhatsappDigits(): string {
  return (location.phone || "").replace(/\D/g, "");
}

// Optional table number from the tag deep link (?t=12), sanitized to a short
// alnum token and folded into a fixed server-authored message. Never reflected
// into a URL the client controls.
function tableNote(req: NextRequest): string {
  const raw = req.nextUrl.searchParams.get("t") || "";
  const t = raw.replace(/[^A-Za-z0-9-]/g, "").slice(0, 12);
  return t ? ` (table ${t})` : "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const digits = venueWhatsappDigits();
  if (!digits) return notFoundResponse();

  const tagCode = /^[A-Za-z0-9._-]{1,32}$/.test(code) ? code.toUpperCase() : null;
  const note = tableNote(req);
  const text = encodeURIComponent(`Hi ${business.name}${note}`.trim());
  const destination = `https://wa.me/${digits}?text=${text}`;

  const anonId = req.cookies.get(ANON_COOKIE)?.value || newAnonId();

  after(async () => {
    try {
      await ingestEvent(
        {
          type: "WHATSAPP_CLICK",
          tagCode,
          sessionId: anonId,
          source: "redirect",
          meta: note ? { table: note.replace(/[()]/g, "").replace("table ", "").trim() } : {},
          // Collapse a double-tap within ~5s to one click; a later click counts.
          idempotencyKey: `wa:${anonId}:${tagCode ?? "-"}:${Math.floor(Date.now() / 5000)}`,
        },
        req.headers,
        { rateLimit: true, tenantId: DEPLOYMENT_TENANT_ID }
      );
    } catch (err) {
      console.error("[go/whatsapp] tracking failed", err);
    }
  });

  const res = NextResponse.redirect(destination, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
  setAnonCookie(res, anonId);
  return res;
}

// The permanent resolver. This route is the reason a printed Aries Tap QR never
// has to be reprinted:
//
//     https://<domain>/q/AT001  →  [lookup]  →  wherever the venue points it today
//
// The URL above is what gets physically printed and never changes. The
// destination behind it is a database column the venue edits at will.
//
// A Route Handler rather than a page, because only a Route Handler can return a
// real Response with an arbitrary status. `redirect()` from next/navigation
// always throws a 307/308 — and a 308 is *permanent*, which is precisely wrong
// for a destination that is designed to change: browsers would cache it and
// stop asking us, stranding guests on an old link forever.

import { NextResponse, after, type NextRequest } from "next/server";
import { clientIp } from "@/lib/wifi/request";
import { store } from "@/lib/wifi/store";
import { QR_BASE_URL, SCAN_IP_RULE } from "@/lib/qr/config";
import { getQrByCode, recordScan } from "@/lib/qr/db";
import { printedCode } from "@/lib/qr/registry";
import { inactiveResponse, notFoundResponse } from "@/lib/qr/statusPage";
import { normalizeQrCode, validateDestinationUrl } from "@/lib/qr/validation";
import { ingestEvent } from "@/lib/events/ingest";
import { tagStatus } from "@/lib/events/tags";
import { ANON_COOKIE, newAnonId, setAnonCookie } from "@/lib/events/session";
import { setTableCookie } from "@/lib/table/session";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = normalizeQrCode(rawCode);
  if (!code) return notFoundResponse();

  // The database is the live source of truth, but it must never be a single
  // point of failure for a physical product. A miss OR an outage falls through
  // to the printed-code registry (see lib/qr/registry.ts) so a QR that exists in
  // the real world always resolves somewhere sensible.
  let qr = null as Awaited<ReturnType<typeof getQrByCode>>;
  let dbReachable = true;
  try {
    qr = await getQrByCode(code);
  } catch (err) {
    dbReachable = false;
    console.error("[qr] lookup failed, falling back to printed registry", err);
  }

  if (!qr) {
    const printed = printedCode(code);
    if (!printed) return notFoundResponse();
    // Known-printed code with no live row: honour the destination it was
    // printed against rather than showing a guest an error.
    const fallback = validateDestinationUrl(printed.fallbackUrl);
    if (!fallback.ok) return notFoundResponse();
    const res = NextResponse.redirect(fallback.url, {
      status: 302,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
    if (dbReachable) {
      // Reachable-but-unseeded is a real operational gap worth surfacing;
      // an outage already logged above.
      console.warn(`[qr] ${code} served from printed registry (no db row)`);
    }
    return res;
  }

  if (qr.archivedAt) return notFoundResponse();
  if (!qr.isActive) return inactiveResponse();

  // Defensive re-validation. The write path already allowlists schemes, but a
  // redirect is exactly the wrong place to trust stored data — a bad value here
  // would be an open-redirect gadget carrying our domain's reputation.
  const check = validateDestinationUrl(qr.destinationUrl);
  if (!check.ok) return inactiveResponse();

  // Everything below happens *after* the response is sent. A scan must never
  // wait on analytics.
  const userAgent = req.headers.get("user-agent") ?? "";
  const referer = req.headers.get("referer") ?? "";
  const ip = clientIp(req);

  // An anonymous per-visit id, minted here and carried on the redirect so the
  // same guest's later page view and WhatsApp click attribute to this tap. If
  // the tag points off-domain the cookie won't follow — the tap still counts,
  // it just can't be tied to a downstream conversion.
  const anonId = req.cookies.get(ANON_COOKIE)?.value || newAnonId();

  after(async () => {
    try {
      // Generous per-IP ceiling: real guests never approach it, but it keeps
      // scan analytics from being trivially cheap to pollute. Failing this
      // check skips *logging* only — the guest was already redirected.
      const hits = await store.incrWithTtl(`qr:ip:${ip}`, SCAN_IP_RULE.window);
      if (hits > SCAN_IP_RULE.max) return;
      // Legacy per-tag scan counter (feeds the QR admin), kept for continuity.
      await recordScan({ qrCodeId: qr.id, userAgent, referer });
      // The unified event the owner dashboard reads + streams live. A 5s
      // idempotency bucket collapses a prefetch/double-hit while still counting
      // a genuine repeat tap moments later.
      await ingestEvent(
        {
          type: "NFC_TAP",
          tagCode: qr.code,
          sessionId: anonId,
          source: "resolver",
          meta: { label: qr.label, referer: referer.slice(0, 160) },
          idempotencyKey: `nfc:${anonId}:${qr.code}:${Math.floor(Date.now() / 5000)}`,
        },
        req.headers,
        {
          rateLimit: false,
          // Attribute authoritatively to this tag's owner — the row we already
          // fetched — so the event is filed under the tenant that owns the tag,
          // never one a request could claim. requireActiveTag re-asserts the
          // lifecycle gate we checked above.
          tag: {
            id: qr.id,
            tenantId: qr.tenantId,
            code: qr.code,
            label: qr.label,
            status: tagStatus({ isActive: qr.isActive, archivedAt: qr.archivedAt }),
          },
          requireActiveTag: true,
        }
      );
    } catch (err) {
      console.error("[qr] scan logging failed", err);
    }
  });

  // Status must be passed inside the init object: NextResponse.redirect(url, 302)
  // takes a numeric-shorthand branch that only sets Location, silently dropping
  // any headers — which would let a stale destination stick in caches after the
  // venue changes it, defeating the entire feature.
  // The tag knows which table it is glued to, so the guest never has to. The
  // table rides the visit as a cookie (surviving every later navigation the
  // guest makes) and, for same-origin destinations, as a `?t=` hint so the
  // landing page has it before the first paint.
  let target = check.url;
  if (qr.table) {
    try {
      const u = new URL(check.url);
      const base = new URL(QR_BASE_URL);
      // Only ever decorate our own URLs. Appending a parameter to a third-party
      // link leaks venue data to them and can break signed or exact-match URLs.
      if (u.host === base.host && !u.searchParams.has("t")) {
        u.searchParams.set("t", qr.table);
        target = u.toString();
      }
    } catch {
      /* keep the validated destination exactly as stored */
    }
  }

  const res = NextResponse.redirect(target, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
  setAnonCookie(res, anonId);
  setTableCookie(res, qr.table);
  return res;
}

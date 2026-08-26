// The Overview cards' data plane. Behind the signed admin cookie, tenant-scoped,
// and computed server-side (aggregated in SQL when a real DB is present). The
// browser receives finished numbers plus a small tag table — never raw events.
//
// The tenant is resolved from the owner's session, not a URL or query — so the
// numbers are always exactly this owner's business and cannot be widened by
// editing the request (spec §25).

import { NextResponse, type NextRequest } from "next/server";
import { resolveOwnerTenant } from "@/lib/events/tenant";
import { overviewMetrics } from "@/lib/events/db";
import { listQrCodesForTenant } from "@/lib/qr/db";
import type { TagInfo } from "@/lib/events/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = await resolveOwnerTenant(req);
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // The QR/NFC registry doubles as the tag registry: a live (non-archived) code
  // is a physical Aries Tap tag. Active = redirecting right now. Scoped to the
  // owner's tenant so the tag table can only ever show their own codes.
  const codes = await listQrCodesForTenant(tenantId, 500);
  const tags: TagInfo[] = codes
    .filter((c) => !c.archivedAt)
    .map((c) => ({ code: c.code, label: c.label, isActive: c.isActive }));

  const metrics = await overviewMetrics(tenantId, tags);
  return NextResponse.json(metrics, {
    headers: { "Cache-Control": "no-store" },
  });
}

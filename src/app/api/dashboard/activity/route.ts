// The activity feed's data plane: a cursor-paginated, tenant-scoped, newest-first
// slice of the event stream, behind the signed admin cookie. This is what the
// dashboard loads for its initial feed and what "load older" pages through — the
// live tail arrives separately over SSE.
//
// The tenant comes from the owner's session, so paging can only ever walk this
// owner's own events (spec §25).

import { NextResponse, type NextRequest } from "next/server";
import { resolveOwnerTenant } from "@/lib/events/tenant";
import { ACTIVITY_PAGE_SIZE } from "@/lib/events/config";
import { listActivity } from "@/lib/events/db";
import { logEvent } from "@/lib/events/log";
import { isTapEventType, type TapEventType } from "@/lib/events/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = await resolveOwnerTenant(req);
  if (!tenantId) {
    logEvent("authz_failure", { route: "dashboard/activity" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const cursor = params.get("cursor");
  const limitRaw = Number(params.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : ACTIVITY_PAGE_SIZE;

  // Optional allow-listed type filter: ?type=NFC_TAP,WHATSAPP_CLICK
  const types = (params.get("type") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isTapEventType) as TapEventType[];

  const { events, nextCursor } = await listActivity(tenantId, { cursor, limit, types });
  return NextResponse.json(
    { events, nextCursor },
    { headers: { "Cache-Control": "no-store" } }
  );
}

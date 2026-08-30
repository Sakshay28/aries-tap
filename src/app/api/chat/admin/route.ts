// The "AI Chat" card's data plane for the owner dashboard: what guests have been
// asking the AI Host, newest first, scoped to the authenticated owner's tenant.
// Behind the same signed admin cookie as every other dashboard read; the tenant
// is resolved from the session, never from the request, so an owner can only
// ever read their own venue's history.

import { NextResponse, type NextRequest } from "next/server";
import { resolveOwnerTenant } from "@/lib/events/tenant";
import { listChatTurns, chatStats } from "@/lib/chat/db";
import { logEvent } from "@/lib/events/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = await resolveOwnerTenant(req);
  if (!tenantId) {
    logEvent("authz_failure", { route: "chat/admin" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [stats, turns] = await Promise.all([
    chatStats(tenantId),
    listChatTurns(tenantId, 300),
  ]);

  return NextResponse.json(
    {
      stats,
      messages: turns.map((t) => ({
        id: t.id,
        table: t.table,
        question: t.question,
        answer: t.answer,
        createdAt: t.createdAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

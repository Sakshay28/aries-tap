import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/wifi/session";
import { ADMIN_COOKIE, TENANT_ID } from "@/lib/review/config";
import { computeAnalytics } from "@/lib/review/analytics";
import { listEvents, listFeedback, updateFeedbackStatus } from "@/lib/review/db";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/review/types";

// The reviews dashboard's data plane. Everything here is behind the signed admin
// cookie (same session as the WiFi dashboard). GET returns the computed funnel
// + metrics + the recent feedback; `?format=csv` streams the complaints for a
// spreadsheet. PATCH drives the manager resolution workflow.

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const payload = await verifyToken<{ kind?: string }>(
    req.cookies.get(ADMIN_COOKIE)?.value
  );
  return payload?.kind === "admin";
}

// Only the most recent slice is sent to the browser (photos are inline data
// URLs and can be heavy); analytics are always computed over the full set.
const LIST_LIMIT = 150;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [feedback, events] = await Promise.all([
    listFeedback(TENANT_ID, 1000),
    listEvents(TENANT_ID, 8000),
  ]);
  const analytics = computeAnalytics(events, feedback);

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(feedback), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aries-reviews-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    analytics,
    feedback: feedback.slice(0, LIST_LIMIT),
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { id?: string; status?: string; notes?: string; resolvedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status as ReviewStatus | undefined;
  if (!id || !status || !REVIEW_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid update." }, { status: 422 });
  }

  await updateFeedbackStatus({
    id,
    status,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : undefined,
    resolvedBy:
      status === "resolved" || status === "closed"
        ? (typeof body.resolvedBy === "string" && body.resolvedBy.trim()) || "Manager"
        : undefined,
  });

  return NextResponse.json({ ok: true });
}

function toCsv(rows: Awaited<ReturnType<typeof listFeedback>>): string {
  const header = [
    "created_at", "rating", "status", "categories", "priority", "department",
    "severity", "summary", "feedback", "contact_requested", "name", "phone",
    "email", "table", "device", "city", "country", "photos",
  ];
  const lines = rows.map((r) =>
    [
      r.createdAt, r.rating, r.status, (r.ai?.categories ?? []).join("|"),
      r.ai?.priority ?? "", r.ai?.department ?? "", r.ai?.severity ?? "",
      r.ai?.summary ?? "", r.feedback, r.contactRequested, r.name, r.phone,
      r.email, r.table, r.device, r.city, r.country, r.images.length,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

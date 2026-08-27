import { NextRequest, NextResponse } from "next/server";
import { listLeads, leadStats } from "@/lib/wifi/db";
import { verifyToken } from "@/lib/wifi/session";
import { prettyPhone } from "@/lib/wifi/phone";
import { ADMIN_COOKIE } from "@/lib/wifi/config";

// Leads for the admin dashboard. Behind the admin session cookie. `?format=csv`
// streams a download; otherwise JSON for the dashboard.

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const payload = await verifyToken<{ kind?: string }>(
    req.cookies.get(ADMIN_COOKIE)?.value
  );
  return payload?.kind === "admin";
}

function toCsv(rows: Awaited<ReturnType<typeof listLeads>>): string {
  const header = ["phone", "table", "venue", "consent", "consent_version", "created_at"];
  const lines = rows.map((r) =>
    [r.phone, r.table, r.venue, r.consent, r.consentVersion, r.createdAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rows = await listLeads(1000);

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aries-leads-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  const stats = await leadStats();
  return NextResponse.json({
    stats,
    leads: rows.map((r) => ({
      id: r.id,
      phone: prettyPhone(r.phone),
      table: r.table,
      venue: r.venue,
      createdAt: r.createdAt,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/wifi/session";
import { ADMIN_COOKIE } from "@/lib/playwin/config";
import { computeAnalytics } from "@/lib/playwin/analytics";
import { listClaims, listPlays } from "@/lib/playwin/db";

// The Play & Win dashboard's data plane, behind the shared signed admin cookie.
// GET returns computed analytics + the recent claims (the leads); `?format=csv`
// streams the leads for a spreadsheet / CRM import.

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const payload = await verifyToken<{ kind?: string }>(req.cookies.get(ADMIN_COOKIE)?.value);
  return payload?.kind === "admin";
}

const LIST_LIMIT = 200;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [plays, claims] = await Promise.all([listPlays(20000), listClaims(20000)]);
  const analytics = computeAnalytics(plays, claims);

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(claims), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aries-playwin-leads-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ analytics, claims: claims.slice(0, LIST_LIMIT) });
}

function toCsv(rows: Awaited<ReturnType<typeof listClaims>>): string {
  const header = [
    "created_at", "reward", "coupon_code", "status", "redeemed_at", "game",
    "name", "phone", "whatsapp", "birthday", "email", "marketing_consent",
    "table", "city", "country", "expires_at",
  ];
  const lines = rows.map((r) =>
    [
      r.createdAt, r.rewardTitle, r.couponCode, r.status, r.redeemedAt ?? "", r.gameKey,
      r.name, r.phone, r.whatsapp, r.birthday, r.email, r.marketingConsent,
      r.table, r.city, r.country, r.expiresAt,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

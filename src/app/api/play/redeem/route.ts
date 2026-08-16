import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/wifi/session";
import { ADMIN_COOKIE } from "@/lib/playwin/config";
import { redeemClaim } from "@/lib/playwin/db";
import { verifyRewardToken } from "@/lib/playwin/token";

// The redemption endpoint the staff redeem screen posts to. The reward token in
// the body proves *which* claim (signed, unforgeable); the admin cookie proves
// it's a staff member doing the redeeming. Redemption is single-use, enforced in
// the DB — a screenshot of the QR can be scanned twice but only redeemed once.

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const payload = await verifyToken<{ kind?: string }>(req.cookies.get(ADMIN_COOKIE)?.value);
  return payload?.kind === "admin";
}

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const proof = await verifyRewardToken(body.token);
  if (!proof) {
    return NextResponse.json({ error: "This reward is invalid or has expired." }, { status: 422 });
  }

  if (!(await requireAdmin(req))) {
    return NextResponse.json(
      { error: "Staff sign-in required.", needAuth: true },
      { status: 401 },
    );
  }

  const outcome = await redeemClaim(proof.claimId, "Staff");
  if (outcome.ok) {
    return NextResponse.json({ ok: true, status: "redeemed", redeemedAt: outcome.row.redeemedAt });
  }

  const status =
    outcome.reason === "expired"
      ? "expired"
      : outcome.reason === "already_redeemed"
        ? "redeemed"
        : "not_found";
  return NextResponse.json(
    { ok: false, reason: outcome.reason, status, redeemedAt: outcome.row?.redeemedAt ?? null },
    { status: outcome.reason === "not_found" ? 404 : 409 },
  );
}

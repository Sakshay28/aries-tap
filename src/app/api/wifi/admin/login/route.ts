import { NextResponse } from "next/server";
import { signToken, sha256Hex } from "@/lib/wifi/session";
import { ADMIN_COOKIE, ADMIN_TTL_SECONDS } from "@/lib/wifi/config";
import { DEPLOYMENT_TENANT_ID } from "@/lib/events/tenant";
import { logEvent } from "@/lib/events/log";

// Single-password admin login. The password is compared by hash and the result
// is a signed, httpOnly session cookie. In dev, if ADMIN_PASSWORD is unset we
// accept "admin" so the dashboard is reachable without configuration.

export async function POST(req: Request) {
  // Fail closed in production: never let the "admin" development default become a
  // real authentication path. Refuse login outright until ADMIN_PASSWORD is set.
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    logEvent("authn_failure", { reason: "admin_password_unconfigured" });
    return NextResponse.json({ error: "Admin login is not configured." }, { status: 503 });
  }
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const supplied = await sha256Hex(body.password ?? "");
  const expected = await sha256Hex(adminPassword);
  if (supplied !== expected) {
    logEvent("authn_failure", { reason: "wrong_admin_password" });
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  // Record which tenant this owner administers, so the dashboard's reads and its
  // realtime subscription are scoped to exactly this business server-side.
  const token = await signToken({ kind: "admin", tenantId: DEPLOYMENT_TENANT_ID }, ADMIN_TTL_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  });
  return res;
}

// Single-password owner login for the multi-venue dashboard. Compared by hash;
// the result is a signed, httpOnly session cookie distinct from the per-venue
// admin cookie. Fails closed in production until OWNER_PASSWORD is configured.

import { NextResponse } from "next/server";
import { signToken, sha256Hex } from "@/lib/wifi/session";
import { OWNER_COOKIE, OWNER_TTL_SECONDS, OWNER_PASSWORD } from "@/lib/owner/session";
import { logEvent } from "@/lib/events/log";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.OWNER_PASSWORD) {
    logEvent("authn_failure", { reason: "owner_password_unconfigured" });
    return NextResponse.json({ error: "Owner login is not configured." }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const supplied = await sha256Hex(body.password ?? "");
  const expected = await sha256Hex(OWNER_PASSWORD);
  if (supplied !== expected) {
    logEvent("authn_failure", { reason: "wrong_owner_password" });
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const token = await signToken({ kind: "owner" }, OWNER_TTL_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_TTL_SECONDS,
  });
  return res;
}

import { NextResponse } from "next/server";
import { signToken, sha256Hex } from "@/lib/wifi/session";
import { ADMIN_COOKIE, ADMIN_TTL_SECONDS } from "@/lib/wifi/config";

// Single-password admin login. The password is compared by hash and the result
// is a signed, httpOnly session cookie. In dev, if ADMIN_PASSWORD is unset we
// accept "admin" so the dashboard is reachable without configuration.

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const supplied = await sha256Hex(body.password ?? "");
  const expected = await sha256Hex(ADMIN_PASSWORD);
  if (supplied !== expected) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const token = await signToken({ kind: "admin" }, ADMIN_TTL_SECONDS);
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

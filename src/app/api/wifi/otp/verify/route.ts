import { NextResponse } from "next/server";
import { business } from "@/lib/content";
import { normalizeIndianMobile } from "@/lib/wifi/phone";
import { verifyOtp } from "@/lib/wifi/otp";
import { insertLead } from "@/lib/wifi/db";
import { signToken, sha256Hex } from "@/lib/wifi/session";
import { clientIp } from "@/lib/wifi/request";
import { VERIFY_COOKIE, VERIFY_TTL_SECONDS, CONSENT_VERSION } from "@/lib/wifi/config";

// Verify the code. On success we record the lead (the whole point) and set a
// short-lived signed cookie that unlocks the credentials endpoint.

export async function POST(req: Request) {
  let body: { phone?: string; code?: string; consent?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const phone = normalizeIndianMobile(body.phone ?? "");
  const code = (body.code ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 422 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Consent is required." }, { status: 422 });
  }

  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "That code expired. Request a new one."
        : result.reason === "locked"
          ? "Too many attempts. Request a new code."
          : "Incorrect code. Try again.";
    const status = result.reason === "mismatch" ? 401 : 410;
    return NextResponse.json({ error: message, reason: result.reason }, { status });
  }

  // Verified — persist the lead. IP is hashed (we keep the number, not the IP).
  await insertLead({
    phone,
    venue: business.name,
    consent: true,
    consentVersion: CONSENT_VERSION,
    ipHash: (await sha256Hex(clientIp(req))).slice(0, 32),
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  });

  const token = await signToken({ phone, kind: "wifi" }, VERIFY_TTL_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VERIFY_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VERIFY_TTL_SECONDS,
  });
  return res;
}

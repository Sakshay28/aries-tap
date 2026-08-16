import { NextResponse } from "next/server";
import { business } from "@/lib/content";
import { normalizeIndianMobile } from "@/lib/wifi/phone";
import { checkSendLimits } from "@/lib/wifi/ratelimit";
import { issueOtp, OTP_TTL_SECONDS } from "@/lib/wifi/otp";
import { sendOtp } from "@/lib/wifi/delivery";
import { clientIp, verifyTurnstile } from "@/lib/wifi/request";

// Send a WhatsApp OTP. Order matters: bot check → rate limit → issue → deliver.
// We rate-limit BEFORE issuing/sending so abuse never reaches the paid channel.

export async function POST(req: Request) {
  let body: { phone?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const phone = normalizeIndianMobile(body.phone ?? "");
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid 10-digit mobile number." },
      { status: 422 }
    );
  }

  const ip = clientIp(req);

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: "Verification failed. Try again." }, { status: 403 });
  }

  const limit = await checkSendLimits(phone, ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfter },
      { status: 429 }
    );
  }

  const code = await issueOtp(phone);
  const result = await sendOtp({
    phone,
    code,
    venue: business.name,
    ttlSeconds: OTP_TTL_SECONDS,
  });

  if (!result.delivered) {
    return NextResponse.json(
      { error: "Could not send the code. Please try again." },
      { status: 502 }
    );
  }

  // resendIn matches the per-phone cooldown so the client can show a timer.
  return NextResponse.json({
    ok: true,
    resendIn: 60,
    // Present only from the dev fallback (no live WhatsApp) — lets the local
    // UI show the code. usingRealDelivery is false → this is undefined in prod.
    devCode: result.devCode,
  });
}

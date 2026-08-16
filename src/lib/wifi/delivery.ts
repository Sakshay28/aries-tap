// OTP delivery. We own the code; Aries owns the pipe. This calls the Aries
// automation over one authenticated HTTP request; Aries relays it to the guest
// over the official WhatsApp Business Cloud API using the approved
// `wifi_otp` authentication template.
//
// Swapping to a different channel later means writing another function here —
// nothing upstream changes.

const WEBHOOK = process.env.ARIES_OTP_WEBHOOK_URL;
const API_KEY = process.env.ARIES_API_KEY;

export const usingRealDelivery = Boolean(WEBHOOK && API_KEY);

export type DeliveryResult = {
  delivered: boolean;
  // Only populated by the dev fallback so the local UI can display the code.
  // Never returned to the client in production.
  devCode?: string;
};

export async function sendOtp(opts: {
  phone: string;
  code: string;
  venue: string;
  ttlSeconds: number;
}): Promise<DeliveryResult> {
  if (!usingRealDelivery) {
    // Dev fallback: no live WhatsApp. Log it and hand it back so the flow is
    // fully testable without any provider wired up.
    console.info(
      `[wifi-otp:dev] code for ${opts.phone} @ ${opts.venue}: ${opts.code}`
    );
    return { delivered: true, devCode: opts.code };
  }

  const res = await fetch(WEBHOOK!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: opts.phone,
      code: opts.code,
      channel: "whatsapp",
      template: "wifi_otp",
      venue: opts.venue,
      ttlSeconds: opts.ttlSeconds,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[wifi-otp] Aries delivery failed ${res.status}`);
    return { delivered: false };
  }
  return { delivered: true };
}

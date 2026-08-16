// Abuse & cost control — the single most important thing at 1000/day, because
// every OTP send costs money and an open endpoint is an invitation to bomb it.
// All counters live in the shared store (Redis in prod), keyed by phone and IP.

import { store } from "./store";

export type Limit = { ok: true } | { ok: false; retryAfter: number; reason: string };

const RULES = {
  perPhoneCooldown: { max: 1, window: 60 }, // one code per minute per number
  perPhoneDaily: { max: 5, window: 60 * 60 * 24 }, // five codes/day per number
  perIpHourly: { max: 15, window: 60 * 60 }, // fifteen sends/hour per IP
};

async function bump(
  key: string,
  max: number,
  window: number,
  reason: string
): Promise<Limit> {
  const count = await store.incrWithTtl(key, window);
  if (count > max) {
    const retryAfter = await store.ttl(key);
    return { ok: false, retryAfter: retryAfter > 0 ? retryAfter : window, reason };
  }
  return { ok: true };
}

// Call before sending an OTP. Checks all three windows; the first breach wins.
export async function checkSendLimits(phone: string, ip: string): Promise<Limit> {
  const cooldown = await bump(
    `otp:cd:${phone}`,
    RULES.perPhoneCooldown.max,
    RULES.perPhoneCooldown.window,
    "Please wait before requesting another code."
  );
  if (!cooldown.ok) return cooldown;

  const daily = await bump(
    `otp:day:${phone}`,
    RULES.perPhoneDaily.max,
    RULES.perPhoneDaily.window,
    "Too many codes for this number today. Try again tomorrow."
  );
  if (!daily.ok) return daily;

  const perIp = await bump(
    `otp:ip:${ip}`,
    RULES.perIpHourly.max,
    RULES.perIpHourly.window,
    "Too many requests from this network. Try again later."
  );
  if (!perIp.ok) return perIp;

  return { ok: true };
}

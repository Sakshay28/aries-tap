// Abuse control for review submissions and events, on the same shared store
// (Upstash in prod, in-memory in dev) the OTP flow uses. Two jobs: throttle by
// device + IP, and drop duplicate submissions so a double-tap or a retrying
// offline queue never creates two rows.

import { store } from "@/lib/wifi/store";
import { sha256Hex } from "@/lib/wifi/session";
import {
  DUPLICATE_WINDOW_SECONDS,
  EVENT_IP_RULE,
  SUBMIT_RULES,
} from "./config";

export type Limit = { ok: true } | { ok: false; retryAfter: number; reason: string };

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

// Call before storing a submission. Device cooldown → device daily → IP hourly;
// first breach wins, mirroring the OTP limiter's shape.
export async function checkSubmitLimits(
  deviceId: string,
  ipHash: string
): Promise<Limit> {
  const cooldown = await bump(
    `rv:cd:${deviceId}`,
    SUBMIT_RULES.perDeviceCooldown.max,
    SUBMIT_RULES.perDeviceCooldown.window,
    "You're sending feedback a little fast — give it a moment."
  );
  if (!cooldown.ok) return cooldown;

  const daily = await bump(
    `rv:day:${deviceId}`,
    SUBMIT_RULES.perDeviceDaily.max,
    SUBMIT_RULES.perDeviceDaily.window,
    "That's a lot of feedback from this device today. Try again tomorrow."
  );
  if (!daily.ok) return daily;

  const perIp = await bump(
    `rv:ip:${ipHash}`,
    SUBMIT_RULES.perIpHourly.max,
    SUBMIT_RULES.perIpHourly.window,
    "Too many submissions from this network. Try again later."
  );
  if (!perIp.ok) return perIp;

  return { ok: true };
}

// Lightweight ceiling on analytics events per IP, so the funnel can't be
// stuffed. Never blocks a real guest.
export async function checkEventLimit(ipHash: string): Promise<boolean> {
  const count = await store.incrWithTtl(
    `rv:ev:${ipHash}`,
    EVENT_IP_RULE.window
  );
  return count <= EVENT_IP_RULE.max;
}

// —————————————————————————————— duplicate detection

// A fingerprint of what makes two submissions "the same": device + rating +
// the feedback text. If we've seen it inside the window, we return the stored
// id instead of inserting again (idempotent submit).
export async function fingerprint(
  deviceId: string,
  rating: number,
  feedback: string
): Promise<string> {
  return sha256Hex(`${deviceId}|${rating}|${feedback.trim().toLowerCase()}`);
}

export async function recentDuplicateId(fp: string): Promise<string | null> {
  return store.get(`rv:dup:${fp}`);
}

export async function rememberSubmission(fp: string, id: string): Promise<void> {
  await store.set(`rv:dup:${fp}`, id, DUPLICATE_WINDOW_SECONDS);
}

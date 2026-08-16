// Abuse control for Play & Win, on the same shared store (Upstash in prod,
// in-memory in dev) as the OTP + Review limiters. Jobs:
//   • throttle plays by device cooldown / device-day backstop / IP.
//   • enforce the per-game "one play per 24h" limit (the repeat-visit engine).
//   • throttle claims and cap one claim per phone per day.
//   • make claim idempotent so a double-tap can't mint two rewards.
// Keys are namespaced `pw:*` so they never collide with `rv:*` / OTP keys.

import { store } from "@/lib/wifi/store";
import { sha256Hex } from "@/lib/wifi/session";
import { CLAIM_RULES, EVENT_IP_RULE, PLAY_RULES } from "./config";

export type Limit =
  | { ok: true }
  | { ok: false; retryAfter: number; reason: string };

async function bump(
  key: string,
  max: number,
  window: number,
  reason: string,
): Promise<Limit> {
  const count = await store.incrWithTtl(key, window);
  if (count > max) {
    const retryAfter = await store.ttl(key);
    return { ok: false, retryAfter: retryAfter > 0 ? retryAfter : window, reason };
  }
  return { ok: true };
}

// —————————————————————————————— plays

// Cheap throttles that run before we decide an outcome. Cooldown → device-day
// backstop → IP; first breach wins.
export async function checkPlayLimits(
  deviceId: string,
  ipHash: string,
): Promise<Limit> {
  const cooldown = await bump(
    `pw:cd:${deviceId}`,
    PLAY_RULES.perDeviceCooldown.max,
    PLAY_RULES.perDeviceCooldown.window,
    "One tap at a time — give it a second.",
  );
  if (!cooldown.ok) return cooldown;

  const daily = await bump(
    `pw:day:${deviceId}`,
    PLAY_RULES.perDeviceDaily.max,
    PLAY_RULES.perDeviceDaily.window,
    "You've played plenty today — come back tomorrow for more.",
  );
  if (!daily.ok) return daily;

  const perIp = await bump(
    `pw:ip:${ipHash}`,
    PLAY_RULES.perIpHourly.max,
    PLAY_RULES.perIpHourly.window,
    "Too many plays from this network right now. Try again later.",
  );
  if (!perIp.ok) return perIp;

  return { ok: true };
}

// The per-game daily limit — "one play per 24h" and the Daily Mystery Box.
// Consumes the day's slot on success, so call it only when about to record a
// play. Returns retryAfter so the UI can say when they can return.
export async function consumeGameDaily(
  deviceId: string,
  gameKey: string,
  limit: number,
): Promise<Limit> {
  return bump(
    `pw:g:${gameKey}:${deviceId}`,
    limit,
    PLAY_RULES.perDeviceDaily.window, // 24h rolling window
    "You've already played this game today. Come back tomorrow!",
  );
}

// Read-only: has this device used up its daily plays for a game? Powers the
// "you haven't tried Scratch Card yet today" nudge without consuming a slot.
export async function hasPlayedGameToday(
  deviceId: string,
  gameKey: string,
  limit: number,
): Promise<boolean> {
  const raw = await store.get(`pw:g:${gameKey}:${deviceId}`);
  return raw != null && Number(raw) >= limit;
}

// —————————————————————————————— claims

export async function checkClaimLimits(
  deviceId: string,
  ipHash: string,
): Promise<Limit> {
  const cooldown = await bump(
    `pw:clcd:${deviceId}`,
    CLAIM_RULES.perDeviceCooldown.max,
    CLAIM_RULES.perDeviceCooldown.window,
    "Hang on a moment and try again.",
  );
  if (!cooldown.ok) return cooldown;

  const perIp = await bump(
    `pw:clip:${ipHash}`,
    CLAIM_RULES.perIpHourly.max,
    CLAIM_RULES.perIpHourly.window,
    "Too many claims from this network. Try again later.",
  );
  if (!perIp.ok) return perIp;

  return { ok: true };
}

export async function checkPhoneDaily(phoneHash: string): Promise<Limit> {
  return bump(
    `pw:clph:${phoneHash}`,
    CLAIM_RULES.perPhoneDaily.max,
    CLAIM_RULES.perPhoneDaily.window,
    "This number has already claimed a reward today.",
  );
}

// —————————————————————————————— claim idempotency

// A double-submit (rage-tap, retry) must resolve to the same reward, not a
// second one. We remember the claimId a play produced for a short window.
export async function rememberClaim(playId: string, claimId: string): Promise<void> {
  await store.set(`pw:claim:${playId}`, claimId, 60 * 60 * 6);
}

export async function recentClaimId(playId: string): Promise<string | null> {
  return store.get(`pw:claim:${playId}`);
}

// —————————————————————————————— events

export async function checkEventLimit(ipHash: string): Promise<boolean> {
  const count = await store.incrWithTtl(`pw:ev:${ipHash}`, EVENT_IP_RULE.window);
  return count <= EVENT_IP_RULE.max;
}

// A stable, non-reversible key for a phone number — for the per-phone limit and
// dedupe without ever storing the raw number in a counter.
export async function phoneKey(phone: string): Promise<string> {
  const salt = process.env.WIFI_SESSION_SECRET || "dev-insecure-session-secret";
  return (await sha256Hex(`pw:${salt}:${phone}`)).slice(0, 32);
}

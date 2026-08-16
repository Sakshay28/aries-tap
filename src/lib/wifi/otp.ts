// OTP lifecycle on top of the store. The code is never kept in plaintext —
// only its SHA-256 — so a leak of the store never leaks live codes.

import { store } from "./store";
import { sha256Hex } from "./session";

export const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;

type OtpRecord = { hash: string; attempts: number };

function key(phone: string) {
  return `otp:code:${phone}`;
}

// Cryptographically-random 6-digit code (100000–999999).
function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + n);
}

export async function issueOtp(phone: string): Promise<string> {
  const code = generateCode();
  const record: OtpRecord = { hash: await sha256Hex(code), attempts: 0 };
  await store.set(key(phone), JSON.stringify(record), OTP_TTL_SECONDS);
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "mismatch" | "locked" };

export async function verifyOtp(
  phone: string,
  code: string
): Promise<VerifyResult> {
  const raw = await store.get(key(phone));
  if (!raw) return { ok: false, reason: "expired" };

  const record = JSON.parse(raw) as OtpRecord;
  if (record.attempts >= MAX_ATTEMPTS) {
    await store.del(key(phone));
    return { ok: false, reason: "locked" };
  }

  if ((await sha256Hex(code)) === record.hash) {
    await store.del(key(phone));
    return { ok: true };
  }

  // Wrong code — burn an attempt, preserving the original TTL window.
  const remaining = await store.ttl(key(phone));
  record.attempts += 1;
  await store.set(
    key(phone),
    JSON.stringify(record),
    remaining > 0 ? remaining : OTP_TTL_SECONDS
  );
  return {
    ok: false,
    reason: record.attempts >= MAX_ATTEMPTS ? "locked" : "mismatch",
  };
}

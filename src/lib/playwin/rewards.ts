// The reward engine — the single place an outcome is decided, and the reason
// the whole feature is cheat-resistant. It runs ONLY on the server (inside the
// play action): the browser is told which slot won *after* the fact and merely
// animates to it. Nothing here is reachable from, or influenced by, the client.
//
// Fairness properties:
//   • crypto-grade randomness (crypto.getRandomValues), not Math.random.
//   • weights are relative and normalized over the currently-available slots.
//   • a reward that has hit its lifetime `maxClaims` is removed from the draw;
//     if that empties the table, we fall back to the losing slot so a play
//     always resolves to *something* rather than erroring on the guest.

import type { ResolvedSlot } from "./config";

// A uniform float in [0, 1) from the CSPRNG. `crypto` is a global in the Next
// server runtime (the same one used elsewhere for randomUUID / subtle).
function secureUnitFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // 2**32 keeps it strictly < 1.
  return buf[0] / 4294967296;
}

export type Draw = { index: number; slot: ResolvedSlot; win: boolean };

// Pick a winning slot index. `excludeRewardIds` zeroes out rewards that are
// exhausted (maxClaims reached); if every slot is excluded, the first slot is
// returned as a graceful floor.
export function drawSlot(
  slots: ResolvedSlot[],
  excludeRewardIds?: ReadonlySet<string>,
): Draw {
  const weights = slots.map((s) =>
    excludeRewardIds?.has(s.reward.id) ? 0 : s.weight,
  );
  const total = weights.reduce((a, b) => a + b, 0);

  // Everything exhausted (or a misconfigured table) — resolve to slot 0 rather
  // than throwing into the guest's face.
  if (total <= 0) {
    const slot = slots[0];
    return { index: 0, slot, win: slot.reward.kind !== "none" };
  }

  let roll = secureUnitFloat() * total;
  for (let i = 0; i < slots.length; i++) {
    roll -= weights[i];
    if (roll < 0) {
      return { index: i, slot: slots[i], win: slots[i].reward.kind !== "none" };
    }
  }

  // Floating-point tail: land on the last non-zero slot.
  for (let i = slots.length - 1; i >= 0; i--) {
    if (weights[i] > 0) {
      return { index: i, slot: slots[i], win: slots[i].reward.kind !== "none" };
    }
  }
  const slot = slots[0];
  return { index: 0, slot, win: slot.reward.kind !== "none" };
}

// A short, human-readable, unguessable coupon code: PREFIX-XXXX. Ambiguous
// characters (0/O, 1/I) are dropped so a server can read it off a phone if a
// scan ever fails.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCode(prefix?: string): string {
  const clean = (prefix || "WIN")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let tail = "";
  for (const b of bytes) tail += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${clean || "WIN"}-${tail}`;
}

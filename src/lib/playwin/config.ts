// Operational constants + the accessors that turn venue config (content.ts
// `playwin`) into two very different views:
//   • publicSettings()  — the client-safe projection. No odds, no caps.
//   • serverGame()      — the full resolved game (slots + weights + rewards)
//                         used only inside server actions to pick an outcome.
// Splitting them here means a component can never accidentally import the odds.

import { business, playwin } from "@/lib/content";
import type {
  GameKey,
  PublicGame,
  PublicReward,
  PublicSettings,
  Reward,
  Slot,
} from "./types";

// One password, every dashboard — reuse the signed admin cookie the WiFi and
// Reviews dashboards already use.
export { ADMIN_COOKIE } from "@/lib/wifi/config";

export const TENANT_ID = business.id;

// —————————————————————————————— signed-token lifetimes

// A play proof only has to survive the walk from the wheel to the claim form.
export const PLAY_TOKEN_TTL_SECONDS = 60 * 15;

// A won reward's default life if the venue hasn't overridden it per-reward.
export const REWARD_TTL_HOURS = clampInt(playwin.rewardTtlHours, 1, 24 * 30, 72);

// —————————————————————————————— abuse control (server-enforced)

// Shaped like the OTP/Review limiters: a fast cooldown to kill double-taps, a
// per-device daily ceiling as a backstop to the per-game daily limit, and an IP
// ceiling so one network can't farm the prize table. Strict to a script,
// invisible to a real guest.
export const PLAY_RULES = {
  perDeviceCooldown: { max: 1, window: 4 }, // 1 play / 4s
  perDeviceDaily: { max: 6, window: 60 * 60 * 24 }, // backstop across all games
  perIpHourly: { max: 60, window: 60 * 60 },
} as const;

export const CLAIM_RULES = {
  perDeviceCooldown: { max: 1, window: 3 },
  perPhoneDaily: { max: 1, window: 60 * 60 * 24 }, // one claim per phone / day
  perIpHourly: { max: 40, window: 60 * 60 },
} as const;

// Analytics events are cheap but must not be a spam vector.
export const EVENT_IP_RULE = { max: 800, window: 60 * 60 } as const;

// —————————————————————————————— input limits

export const MAX_NAME_CHARS = 80;
export const MAX_TABLE_CHARS = 24;
export const MAX_META_BYTES = 1500;

// Fallback palette for reward segments that don't set their own `color`. Warm
// golds + a neutral for the near-miss — never a casino rainbow.
const PALETTE = ["#c8a76e", "#e0c28c", "#b98d4e", "#cdbd8b", "#efd9a6", "#a8905f"];

// —————————————————————————————— reward + game resolution

const REWARD_INDEX: Map<string, Reward> = new Map(
  playwin.rewards.filter((r) => r.enabled !== false).map((r) => [r.id, r])
);

export function rewardById(id: string): Reward | null {
  return REWARD_INDEX.get(id) ?? null;
}

// The full public projection of a reward (safe to send to the browser).
export function toPublicReward(r: Reward, fallbackColor: string): PublicReward {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    value: r.value,
    icon: r.icon,
    color: r.color || fallbackColor,
    terms: r.terms,
  };
}

// A game resolved for the *server*: only enabled slots whose reward still
// exists, each carrying its reward + weight. Order is preserved (Spin needs it).
export type ResolvedSlot = { reward: Reward; weight: number };

export function serverGame(
  gameKey: string
): { key: GameKey; slots: ResolvedSlot[] } | null {
  const g = playwin.games.find((x) => x.key === gameKey && x.enabled);
  if (!g) return null;
  const slots = resolveSlots(g.slots);
  if (slots.length === 0) return null;
  return { key: g.key, slots };
}

export function gameDailyLimit(gameKey: string): number {
  const g = playwin.games.find((x) => x.key === gameKey);
  return clampInt(g?.dailyLimitPerDevice ?? 1, 1, 50, 1);
}

function resolveSlots(slots: Slot[]): ResolvedSlot[] {
  const out: ResolvedSlot[] = [];
  for (const s of slots) {
    const reward = rewardById(s.rewardId);
    const weight = Number(s.weight);
    if (!reward) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    out.push({ reward, weight });
  }
  return out;
}

// —————————————————————————————— public settings (no odds)

export function publicSettings(): PublicSettings {
  const games: PublicGame[] = playwin.games
    .filter((g) => g.enabled && serverGame(g.key))
    .map((g) => {
      const resolved = resolveSlots(g.slots);
      return {
        key: g.key,
        name: g.name,
        tagline: g.tagline,
        icon: g.icon,
        slots: resolved.map((s, i) =>
          toPublicReward(s.reward, PALETTE[i % PALETTE.length])
        ),
      };
    });

  return {
    enabled: playwin.enabled && games.length > 0,
    headline: playwin.headline,
    subhead: playwin.subhead,
    terms: playwin.terms,
    marketingConsentText: playwin.marketingConsentText,
    requireContactToClaim: playwin.requireContactToClaim,
    rewardTtlHours: REWARD_TTL_HOURS,
    games,
  };
}

// The public reward at a given slot index of a game — used server-side to build
// the exact PublicReward the client will animate to (colors must line up).
export function publicRewardAt(gameKey: string, index: number): PublicReward | null {
  const g = playwin.games.find((x) => x.key === gameKey && x.enabled);
  if (!g) return null;
  const resolved = resolveSlots(g.slots);
  const slot = resolved[index];
  if (!slot) return null;
  return toPublicReward(slot.reward, PALETTE[index % PALETTE.length]);
}

// —————————————————————————————— helpers

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

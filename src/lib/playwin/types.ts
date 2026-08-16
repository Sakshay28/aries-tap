// The Play & Win contract — one file every other module in the feature reads
// from, so the shape is defined once. Two audiences live here on purpose:
//   • config types (Reward, Slot, GameConfig) — what a venue authors in
//     content.ts. Includes the odds (`weight`) and other server-only knobs.
//   • public types (PublicReward, PublicGame, PublicSettings) — the projection
//     the browser is allowed to see. It never contains a weight: the odds are a
//     server secret, and the *outcome* of a play is decided and signed on the
//     server, never trusted from the client.

// —————————————————————————————— reward catalog (venue-authored)

// The economic kind of a prize. `value` is interpreted per-kind (see below).
export type RewardKind =
  | "percent" // % off the bill — value is the number, e.g. 20
  | "flat" // ₹ off the bill — value is the number, e.g. 100
  | "freeItem" // a specific free item — value is its label, e.g. "Filter Coffee"
  | "bogo" // buy-one-get-one — value is the item label
  | "combo" // combo / size upgrade — value is the label
  | "points" // loyalty points — value is the number
  | "mystery" // a surprise revealed at the counter — no value
  | "none"; // "better luck next time" — the losing slot

export type Reward = {
  id: string;
  kind: RewardKind;
  title: string; // "20% Off"
  description: string; // "On your total bill, today only"
  value?: string | number;
  icon: string; // a lucide icon key; the client maps it (see registry)
  color?: string; // segment/card accent (hex). Auto-assigned if omitted.
  terms?: string; // fine print shown on the reward card
  couponPrefix?: string; // human-readable code prefix, e.g. "TAF20"
  minOrder?: number; // minimum bill (₹) for the reward to apply
  maxClaims?: number; // lifetime cap across all guests (0/undefined = ∞)
  validHours?: number; // per-reward validity; overrides the tenant default
  enabled?: boolean; // default true
};

// A game draws from a weighted set of slots. For Spin, the slots are the wheel
// segments in display order; for Scratch/Lucky they are the draw table. Weight
// is relative — the engine normalizes the enabled slots to probabilities.
export type Slot = { rewardId: string; weight: number };

export type GameKey =
  | "spin"
  | "scratch"
  | "lucky"
  | "flip"
  | "memory"
  | "tap"
  | "box";

export type GameConfig = {
  key: GameKey;
  enabled: boolean;
  name: string; // "Spin the Wheel"
  tagline: string; // "One spin. One prize."
  icon: string; // lucide key for the selection card
  dailyLimitPerDevice: number; // plays per device per rolling 24h (Daily Box = 1)
  slots: Slot[];
};

export type PlaywinConfig = {
  enabled: boolean;
  headline: string;
  subhead: string;
  terms: string; // claim-screen fine print
  marketingConsentText: string;
  rewardTtlHours: number; // default validity of a won reward
  requireContactToClaim: boolean; // gate the reward behind phone capture
  rewards: Reward[];
  games: GameConfig[];
};

// —————————————————————————————— public projections (client-safe)

// A reward as the browser is allowed to see it — no odds, no lifetime caps.
export type PublicReward = {
  id: string;
  kind: RewardKind;
  title: string;
  description: string;
  value?: string | number;
  icon: string;
  color: string;
  terms?: string;
};

export type PublicGame = {
  key: GameKey;
  name: string;
  tagline: string;
  icon: string;
  // Ordered display slots. For Spin these are the wheel segments, so the order
  // matters and must match the server's slot order (the server returns a
  // resultIndex into exactly this array).
  slots: PublicReward[];
};

export type PublicSettings = {
  enabled: boolean;
  headline: string;
  subhead: string;
  terms: string;
  marketingConsentText: string;
  requireContactToClaim: boolean;
  rewardTtlHours: number;
  games: PublicGame[];
};

// —————————————————————————————— play flow (action I/O)

export type PlayInput = {
  gameKey: string;
  deviceId: string;
  sessionId: string;
  table?: string;
};

export type PlayFailReason =
  | "disabled"
  | "invalid"
  | "already_played"
  | "rate_limited";

export type PlayResult =
  | {
      ok: true;
      playId: string;
      // Short-lived signed proof that *this device* won *this reward* on this
      // play. The claim step requires it, so a client can't forge a better prize.
      playToken: string;
      // Index into the game's ordered public slots — what the wheel lands on /
      // what the scratch card hides. The animation is cosmetic; this is truth.
      resultIndex: number;
      reward: PublicReward;
      win: boolean;
    }
  | {
      ok: false;
      error: string;
      reason: PlayFailReason;
      retryAfter?: number; // seconds until the next play is allowed
      suggestGame?: GameKey; // a game they haven't played today (soft nudge)
    };

export type ClaimInput = {
  playId: string;
  playToken: string;
  deviceId: string;
  sessionId: string;
  name: string;
  phone: string;
  whatsapp?: string;
  birthday?: string; // ISO date (YYYY-MM-DD) or ""
  email?: string;
  marketingConsent: boolean;
};

export type ClaimStatus = "issued" | "redeemed" | "expired";

// The reward card the guest keeps — includes the signed QR the venue scans.
export type ClaimView = {
  claimId: string;
  reward: PublicReward;
  couponCode: string;
  createdAt: string;
  expiresAt: string;
  redeemUrl: string;
  qrSvg: string; // inline, theme-tinted SVG — no network, no image host
  status: ClaimStatus;
};

export type ClaimResult =
  | { ok: true; claim: ClaimView; duplicate?: boolean }
  | { ok: false; error: string; reason?: string };

export type PlayEventName =
  | "opened"
  | "game_selected"
  | "played"
  | "won"
  | "claim_started"
  | "claimed"
  | "shared"
  | "closed";

export type PlayEventInput = {
  sessionId: string;
  name: PlayEventName;
  gameKey?: string;
  meta?: Record<string, string | number | boolean>;
};

// —————————————————————————————— stored rows (Neon / JSON)

export type PlayRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  deviceHash: string;
  gameKey: string;
  rewardId: string;
  rewardTitle: string;
  win: boolean;
  table: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  city: string;
  ipHash: string;
  claimed: boolean;
  createdAt: string;
};

export type ClaimRow = {
  id: string;
  tenantId: string;
  playId: string;
  gameKey: string;
  rewardId: string;
  rewardTitle: string;
  couponCode: string;
  name: string;
  phone: string;
  whatsapp: string;
  birthday: string;
  email: string;
  marketingConsent: boolean;
  deviceHash: string;
  status: ClaimStatus;
  redeemedAt: string | null;
  redeemedBy: string;
  table: string;
  country: string;
  city: string;
  createdAt: string;
  expiresAt: string;
};

// —————————————————————————————— analytics (computed, read-only)

export type GameBreakdown = {
  key: string;
  plays: number;
  wins: number;
  winRate: number;
  claims: number;
};

export type PlaywinAnalytics = {
  playsTotal: number;
  playsToday: number;
  uniqueDevices: number;
  repeatDeviceRate: number; // share of devices that played more than once
  wins: number;
  winRate: number;
  claims: number;
  claimsToday: number;
  conversionRate: number; // claims / plays
  phonesCollected: number;
  emailsCollected: number;
  whatsappCollected: number;
  birthdaysCollected: number;
  marketingOptIns: number;
  redemptions: number;
  redemptionRate: number; // redemptions / claims
  popularGame: { key: string; plays: number } | null;
  topReward: { title: string; count: number } | null;
  byGame: GameBreakdown[];
  hourly: number[]; // 24 buckets of plays, local venue hours
  daily: { date: string; plays: number; claims: number }[];
};

"use server";

// The two write paths of Play & Win, as Server Actions invoked straight from the
// client island. Both treat input as hostile — a Server Action is reachable by a
// raw POST that never touched our UI, so every value is re-derived or re-checked
// here, and the *outcome* of a play is decided on this side of the wire.
//
//   playGame     — throttle → per-game daily gate → draw a reward (server RNG)
//                  → record the play → return the result + a signed play proof.
//   claimReward  — verify the play proof → capture the lead → mint a signed,
//                  single-use reward + QR. Reads live in the admin route, never
//                  here (a "use server" export is a public endpoint).

import { headers } from "next/headers";
import { sha256Hex } from "@/lib/wifi/session";
import { clientContext, clientIp, hashIp } from "@/lib/review/context";
import {
  REWARD_TTL_HOURS,
  TENANT_ID,
  gameDailyLimit,
  publicRewardAt,
  publicSettings,
  rewardById,
  serverGame,
} from "./config";
import {
  countClaimsForRewards,
  getClaim,
  getPlay,
  insertClaim,
  insertPlay,
  markPlayClaimed,
} from "./db";
import {
  checkClaimLimits,
  checkPhoneDaily,
  checkPlayLimits,
  consumeGameDaily,
  hasPlayedGameToday,
  phoneKey,
  recentClaimId,
  rememberClaim,
} from "./ratelimit";
import { drawSlot, generateCouponCode } from "./rewards";
import { signPlayToken, signRewardToken, verifyPlayToken } from "./token";
import { rewardQrSvg } from "./qr";
import { normalizeBirthday, normalizeEmail, normalizePhoneInput, safeId, sanitizeName, sanitizeTable } from "./validation";
import type { ClaimInput, ClaimResult, ClaimView, GameKey, PlayInput, PlayResult } from "./types";

// A stable, non-reversible fingerprint of a client device id. Binds a play (and
// its signed proof) to the device that earned it, without storing the raw id.
async function deviceHashOf(deviceId: string): Promise<string> {
  const salt = process.env.WIFI_SESSION_SECRET || "dev-insecure-session-secret";
  return (await sha256Hex(`pwdev:${salt}:${deviceId}`)).slice(0, 32);
}

// —————————————————————————————— playGame

export async function playGame(input: PlayInput): Promise<PlayResult> {
  try {
    const settings = publicSettings();
    if (!settings.enabled) {
      return { ok: false, error: "Play & Win isn't available right now.", reason: "disabled" };
    }

    const deviceId = safeId(input.deviceId);
    const sessionId = safeId(input.sessionId);
    if (!deviceId || !sessionId) {
      return { ok: false, error: "Your session expired — please reopen the page.", reason: "invalid" };
    }

    const game = serverGame(input.gameKey);
    if (!game) {
      return { ok: false, error: "That game isn't available.", reason: "invalid" };
    }

    const h = await headers();
    const ipHash = await hashIp(clientIp(h));

    // Cheap throttles first.
    const limit = await checkPlayLimits(deviceId, ipHash);
    if (!limit.ok) {
      return { ok: false, error: limit.reason, reason: "rate_limited", retryAfter: limit.retryAfter };
    }

    // The per-game daily gate — consumes the day's slot. Once it's gone, nudge
    // them toward a game they haven't tried today.
    const daily = await consumeGameDaily(deviceId, game.key, gameDailyLimit(game.key));
    if (!daily.ok) {
      const suggestGame = await suggestUnplayedGame(deviceId, game.key);
      return {
        ok: false,
        error: daily.reason,
        reason: "already_played",
        retryAfter: daily.retryAfter,
        suggestGame,
      };
    }

    // Drop any prize that's hit its lifetime cap from the draw.
    const exclude = await exhaustedRewardIds(game.slots.map((s) => s.reward));
    const draw = drawSlot(game.slots, exclude);

    // The public reward is built from config so its color/label line up exactly
    // with what the client will animate to at this index.
    const reward = publicRewardAt(game.key, draw.index);
    if (!reward) {
      return { ok: false, error: "Something went wrong. Please try again.", reason: "invalid" };
    }

    const ctx = clientContext(h);
    const deviceHash = await deviceHashOf(deviceId);

    const { id: playId } = await insertPlay({
      tenantId: TENANT_ID,
      sessionId,
      deviceHash,
      gameKey: game.key,
      rewardId: draw.slot.reward.id,
      rewardTitle: draw.slot.reward.title,
      win: draw.win,
      table: sanitizeTable(input.table),
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      country: ctx.country,
      city: ctx.city,
      ipHash,
    });

    const playToken = await signPlayToken({
      playId,
      rewardId: draw.slot.reward.id,
      gameKey: game.key,
      deviceHash,
    });

    return { ok: true, playId, playToken, resultIndex: draw.index, reward, win: draw.win };
  } catch (err) {
    console.error("[playwin] playGame failed", err);
    return { ok: false, error: "Something went wrong. Please try again.", reason: "invalid" };
  }
}

// —————————————————————————————— claimReward

export async function claimReward(input: ClaimInput): Promise<ClaimResult> {
  try {
    const settings = publicSettings();

    // The proof is the gate: it says exactly which reward this device won.
    const proof = await verifyPlayToken(input.playToken);
    if (!proof) {
      return { ok: false, error: "This reward has expired. Please play again.", reason: "expired" };
    }

    const deviceId = safeId(input.deviceId);
    if (!deviceId) return { ok: false, error: "Your session expired — please play again." };
    const deviceHash = await deviceHashOf(deviceId);
    if (deviceHash !== proof.deviceHash) {
      return { ok: false, error: "This reward belongs to a different device." };
    }

    const play = await getPlay(proof.playId);
    if (!play || play.rewardId !== proof.rewardId) {
      return { ok: false, error: "We couldn't find that reward. Please play again." };
    }

    const reward = rewardById(proof.rewardId);
    if (!reward || reward.kind === "none") {
      return { ok: false, error: "There's no reward to claim on this play." };
    }

    // Idempotency: a double-submit resolves to the same reward, never a second.
    const existingId = await recentClaimId(proof.playId);
    if (existingId) {
      const existing = await getClaim(existingId);
      if (existing) return { ok: true, claim: await toClaimView(existing, await requestOrigin()), duplicate: true };
    }
    if (play.claimed) {
      return { ok: false, error: "This reward has already been claimed." };
    }

    // Contact capture — the growth engine. Required unless the venue turned it
    // off. Normalized to E.164 so the per-phone limit can't be dodged.
    const phone = normalizePhoneInput(input.phone);
    if (settings.requireContactToClaim && !phone) {
      return { ok: false, error: "Enter a valid mobile number to claim your reward." };
    }

    const h = await headers();
    const ipHash = await hashIp(clientIp(h));

    const limit = await checkClaimLimits(deviceId, ipHash);
    if (!limit.ok) return { ok: false, error: limit.reason };

    if (phone) {
      const pk = await phoneKey(phone);
      const phoneLimit = await checkPhoneDaily(pk);
      if (!phoneLimit.ok) return { ok: false, error: phoneLimit.reason };
    }

    const name = sanitizeName(input.name);
    const whatsapp = normalizePhoneInput(input.whatsapp);
    const email = normalizeEmail(input.email);
    const birthday = normalizeBirthday(input.birthday);
    const marketingConsent = Boolean(input.marketingConsent);

    const ctx = clientContext(h);
    const couponCode = generateCouponCode(reward.couponPrefix);
    const ttlHours = reward.validHours ?? REWARD_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    const { id: claimId } = await insertClaim({
      tenantId: TENANT_ID,
      playId: play.id,
      gameKey: play.gameKey,
      rewardId: reward.id,
      rewardTitle: reward.title,
      couponCode,
      name,
      phone,
      whatsapp,
      birthday,
      email,
      marketingConsent,
      deviceHash,
      table: play.table,
      country: ctx.country,
      city: ctx.city,
      expiresAt,
    });

    await markPlayClaimed(play.id);
    await rememberClaim(play.id, claimId);

    const row = await getClaim(claimId);
    if (!row) return { ok: false, error: "Something went wrong. Please try again." };

    return { ok: true, claim: await toClaimView(row, await requestOrigin()) };
  } catch (err) {
    console.error("[playwin] claimReward failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// —————————————————————————————— helpers

// Which of this game's rewards have hit their lifetime `maxClaims`, so the draw
// can skip them. Only queries the DB when at least one reward sets a cap.
async function exhaustedRewardIds(
  rewards: { id: string; maxClaims?: number }[],
): Promise<Set<string> | undefined> {
  const capped = rewards.filter((r) => typeof r.maxClaims === "number" && r.maxClaims! > 0);
  if (capped.length === 0) return undefined;
  const counts = await countClaimsForRewards(capped.map((r) => r.id));
  const out = new Set<string>();
  for (const r of capped) {
    if ((counts[r.id] ?? 0) >= (r.maxClaims as number)) out.add(r.id);
  }
  return out.size ? out : undefined;
}

// First enabled game (other than the one just blocked) this device hasn't used
// up today — powers the "you haven't tried X yet" nudge.
async function suggestUnplayedGame(
  deviceId: string,
  exclude: string,
): Promise<GameKey | undefined> {
  for (const g of publicSettings().games) {
    if (g.key === exclude) continue;
    const used = await hasPlayedGameToday(deviceId, g.key, gameDailyLimit(g.key));
    if (!used) return g.key;
  }
  return undefined;
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? `${proto}://${host}` : "";
}

async function toClaimView(row: Awaited<ReturnType<typeof getClaim>>, origin: string): Promise<ClaimView> {
  const claim = row!;
  const reward = rewardById(claim.rewardId);
  // Re-mint the reward token from the stored claim so the QR always matches the
  // row (and can outlive the in-memory play proof).
  const token = await signRewardToken(
    { claimId: claim.id, rewardId: claim.rewardId },
    Math.max(1, (new Date(claim.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000)),
  );
  const redeemUrl = `${origin}/r/${token}`;
  const qrSvg = await rewardQrSvg(redeemUrl);
  return {
    claimId: claim.id,
    reward: {
      id: claim.rewardId,
      kind: reward?.kind ?? "mystery",
      title: claim.rewardTitle || reward?.title || "Your reward",
      description: reward?.description ?? "",
      value: reward?.value,
      icon: reward?.icon ?? "Gift",
      color: reward?.color ?? "#c8a76e",
      terms: reward?.terms,
    },
    couponCode: claim.couponCode,
    createdAt: claim.createdAt,
    expiresAt: claim.expiresAt,
    redeemUrl,
    qrSvg,
    status: claim.status,
  };
}

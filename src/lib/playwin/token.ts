// Two signed tokens, both HMAC-SHA256 via the app's dependency-free Web Crypto
// helper (the same one behind the WiFi "verified" proof and admin session):
//
//   • playToken   — minted when a play resolves; proves *this device* won *this
//                   reward* on *this play*. The claim step won't mint a reward
//                   without a valid, unexpired one, so a client can't POST a
//                   forged claim for a better prize than it actually won.
//   • rewardToken — minted at claim; the payload the QR encodes. The venue's
//                   scanner verifies the signature offline, so a screenshot of
//                   the code can't be edited into a different reward, and a
//                   fabricated code won't verify at all. Redemption state
//                   (used-once) is enforced separately in the DB.

import { signToken, verifyToken } from "@/lib/wifi/session";
import { PLAY_TOKEN_TTL_SECONDS, REWARD_TTL_HOURS } from "./config";

// —————————————————————————————— play proof

type PlayClaims = {
  k: "play";
  pid: string; // playId
  rid: string; // rewardId
  gk: string; // gameKey
  dev: string; // deviceHash — binds the proof to the device that won
};

export function signPlayToken(data: {
  playId: string;
  rewardId: string;
  gameKey: string;
  deviceHash: string;
}): Promise<string> {
  const claims: PlayClaims = {
    k: "play",
    pid: data.playId,
    rid: data.rewardId,
    gk: data.gameKey,
    dev: data.deviceHash,
  };
  return signToken(claims, PLAY_TOKEN_TTL_SECONDS);
}

export async function verifyPlayToken(token: string | undefined): Promise<{
  playId: string;
  rewardId: string;
  gameKey: string;
  deviceHash: string;
} | null> {
  const p = await verifyToken<PlayClaims>(token);
  if (!p || p.k !== "play" || !p.pid || !p.rid) return null;
  return { playId: p.pid, rewardId: p.rid, gameKey: p.gk, deviceHash: p.dev };
}

// —————————————————————————————— reward proof (the QR payload)

type RewardClaims = {
  k: "reward";
  cid: string; // claimId — the row the venue looks up + flips to redeemed
  rid: string; // rewardId (informational; the row is authoritative)
};

export function signRewardToken(
  data: { claimId: string; rewardId: string },
  ttlHours: number = REWARD_TTL_HOURS,
): Promise<string> {
  const claims: RewardClaims = { k: "reward", cid: data.claimId, rid: data.rewardId };
  return signToken(claims, Math.round(ttlHours * 60 * 60));
}

export async function verifyRewardToken(
  token: string | undefined,
): Promise<{ claimId: string; rewardId: string } | null> {
  const p = await verifyToken<RewardClaims>(token);
  if (!p || p.k !== "reward" || !p.cid) return null;
  return { claimId: p.cid, rewardId: p.rid };
}

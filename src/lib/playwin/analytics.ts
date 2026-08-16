// Pure analytics — no IO, no store, just PlayRow[] + ClaimRow[] in, a
// PlaywinAnalytics out. Kept pure so it's trivial to unit-test and can run over
// the full set on every dashboard load without touching a database twice.

import type {
  ClaimRow,
  GameBreakdown,
  PlaywinAnalytics,
  PlayRow,
} from "./types";

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal
}

export function computeAnalytics(
  plays: PlayRow[],
  claims: ClaimRow[],
): PlaywinAnalytics {
  const now = new Date();

  // —— plays
  const playsTotal = plays.length;
  const playsToday = plays.filter((p) => isSameLocalDay(p.createdAt, now)).length;
  const wins = plays.filter((p) => p.win).length;

  const deviceCounts = new Map<string, number>();
  for (const p of plays) {
    if (!p.deviceHash) continue;
    deviceCounts.set(p.deviceHash, (deviceCounts.get(p.deviceHash) ?? 0) + 1);
  }
  const uniqueDevices = deviceCounts.size;
  let repeats = 0;
  for (const n of deviceCounts.values()) if (n > 1) repeats++;

  // —— claims (leads + redemption)
  const claimsTotal = claims.length;
  const claimsToday = claims.filter((c) => isSameLocalDay(c.createdAt, now)).length;
  const phones = new Set(claims.map((c) => c.phone).filter(Boolean));
  const emailsCollected = claims.filter((c) => c.email).length;
  const whatsappCollected = claims.filter((c) => c.whatsapp).length;
  const birthdaysCollected = claims.filter((c) => c.birthday).length;
  const marketingOptIns = claims.filter((c) => c.marketingConsent).length;
  const redemptions = claims.filter((c) => c.status === "redeemed").length;

  // —— per-game breakdown
  const games = new Map<string, { plays: number; wins: number; claims: number }>();
  for (const p of plays) {
    const g = games.get(p.gameKey) ?? { plays: 0, wins: 0, claims: 0 };
    g.plays++;
    if (p.win) g.wins++;
    games.set(p.gameKey, g);
  }
  for (const c of claims) {
    const g = games.get(c.gameKey) ?? { plays: 0, wins: 0, claims: 0 };
    g.claims++;
    games.set(c.gameKey, g);
  }
  const byGame: GameBreakdown[] = [...games.entries()]
    .map(([key, g]) => ({
      key,
      plays: g.plays,
      wins: g.wins,
      winRate: pct(g.wins, g.plays),
      claims: g.claims,
    }))
    .sort((a, b) => b.plays - a.plays);

  const popularGame = byGame[0] ? { key: byGame[0].key, plays: byGame[0].plays } : null;

  // —— top claimed reward
  const rewardCounts = new Map<string, number>();
  for (const c of claims) {
    const key = c.rewardTitle || c.rewardId;
    rewardCounts.set(key, (rewardCounts.get(key) ?? 0) + 1);
  }
  let topReward: { title: string; count: number } | null = null;
  for (const [title, count] of rewardCounts) {
    if (!topReward || count > topReward.count) topReward = { title, count };
  }

  // —— hourly (plays by hour of day, all-time)
  const hourly = new Array<number>(24).fill(0);
  for (const p of plays) hourly[new Date(p.createdAt).getHours()]++;

  // —— last 14 days
  const daily: { date: string; plays: number; claims: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = d.toISOString().slice(0, 10);
    daily.push({
      date: label,
      plays: plays.filter((p) => isSameLocalDay(p.createdAt, d)).length,
      claims: claims.filter((c) => isSameLocalDay(c.createdAt, d)).length,
    });
  }

  return {
    playsTotal,
    playsToday,
    uniqueDevices,
    repeatDeviceRate: pct(repeats, uniqueDevices),
    wins,
    winRate: pct(wins, playsTotal),
    claims: claimsTotal,
    claimsToday,
    conversionRate: pct(claimsTotal, playsTotal),
    phonesCollected: phones.size,
    emailsCollected,
    whatsappCollected,
    birthdaysCollected,
    marketingOptIns,
    redemptions,
    redemptionRate: pct(redemptions, claimsTotal),
    popularGame,
    topReward,
    byGame,
    hourly,
    daily,
  };
}

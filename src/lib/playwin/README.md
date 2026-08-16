# Play & Win 🎮

A tap-to-play rewards engine for Aries Tap. A guest taps a table tag, plays one
premium game a day, wins a real, redeemable reward, and the venue captures a
phone (plus optional WhatsApp / birthday / email + marketing opt-in) at claim
time. Built to the app's grain: **zero new dependencies**, Neon + JSON fallback,
Upstash + in-memory fallback, Web Crypto signing, hand-authored CSS. Runs with
nothing configured.

## The one rule: the server decides the outcome

The browser never decides what you win. When a guest commits to a play, the
client calls the `playGame` server action, which:

1. throttles the request and enforces the per-game daily limit,
2. draws a slot with a **crypto-grade weighted RNG** (`rewards.ts`),
3. records the play, and
4. returns the result **plus a short-lived, HMAC-signed play token**.

The game component then merely *animates* to `resultIndex` (the wheel spins to
it, the scratch card hides it). The claim step requires that signed token, so a
client can't forge a claim for a better prize than it actually won. This is why
the feature is safe to run "scalable to millions of plays."

## Flow

```
tap → /play → pick a game → play → server draws + signs → animate to result
   → win?  → claim form (phone) → claimReward → signed reward + QR
   → guest shows QR → staff opens /r/<token> → verify signature → Mark redeemed
   → single-use: the claim row flips to 'redeemed', a re-scan can't reuse it
```

## Files

| Area | File |
| --- | --- |
| Contract (config + public + rows) | `types.ts` |
| Venue config (games, prizes, odds) | `../content.ts` → `playwin` |
| Limits, TTLs, public/server projection | `config.ts` |
| Reward engine (weighted draw, coupon codes) | `rewards.ts` |
| Signed play proof + reward QR payload | `token.ts` |
| Inline themed QR (from `qrcode`) | `qr.ts` |
| Anti-fraud (cooldowns, daily gate, phone cap) | `ratelimit.ts` |
| Store (Neon `playwin_plays` + `playwin_claims`, JSON fallback) | `db.ts` |
| Claim-input sanitizers | `validation.ts` |
| Pure analytics | `analytics.ts` |
| Server actions (`playGame`, `claimReward`) | `actions.ts` |
| Client flow (state machine) | `../../components/play/PlayExperience.tsx` |
| Plugin registry + game contract | `../../components/play/games/registry.tsx` |
| Games | `games/SpinWheel.tsx`, `games/ScratchCard.tsx`, `games/LuckyNumber.tsx` |
| Reward card + claim form | `../../components/play/RewardCard.tsx`, `ClaimForm.tsx` |
| Routes | `app/play`, `app/r/[token]`, `app/api/play/{admin,redeem}` |
| Admin dashboard | `app/admin/play` |

## Anti-fraud

- **Server-authoritative outcome** (above) — the core defence.
- **Signed play proof** binds a claim to the exact reward + device that won it.
- **Signed reward QR** — a scanner verifies the HMAC offline; a fabricated or
  edited code fails verification. Redemption is **single-use**, enforced in the
  DB (`UPDATE … WHERE status='issued'`), so a screenshot can be scanned twice but
  redeemed once.
- **One play per device per game per 24h** (the daily gate), plus a device-day
  backstop and an IP hourly ceiling.
- **One claim per phone per day**; claims are idempotent (a double-submit
  returns the same reward).
- Device ids and IPs are only ever stored **hashed**.
- Redemption requires the signed **admin cookie** (staff), not just the token.

## Configure a venue (no code)

Everything is in `src/lib/content.ts` → `playwin`:

- `games[]` — toggle `enabled`, set `dailyLimitPerDevice`, and each game's
  `slots` (a `rewardId` + a **weight**; weights are relative and never sent to
  the browser).
- `rewards[]` — the prize catalog (title, icon, colour, coupon prefix, optional
  `minOrder` / `maxClaims` / `validHours`). Keep a `kind: "none"` slot for a
  believable near-miss.
- `requireContactToClaim`, `rewardTtlHours`, headline/subhead/terms/consent copy.

A game a venue enables but that has no engine is automatically hidden — a guest
can only ever pick a game that will run.

## Add a new game (plugin system)

Each game is a component satisfying `GameComponentProps` (`requestPlay()`,
`onRevealed`, `onError`, `reducedMotion`). To add one:

1. Create `games/YourGame.tsx`.
2. Register it in `games/registry.tsx` (`dynamic(...)`, one line).
3. Add its config to `playwin.games` in `content.ts`.

Nothing else changes. This maps to the spec's `GameEngine` interface —
`calculateReward()` is the server draw, `play()`/`validate()` are the
`playGame` action + token/limit checks, and your component is the presentation.

## Env

Reuses the app's existing vars — nothing to duplicate. See `.env.example`:
`DATABASE_URL`, `UPSTASH_REDIS_REST_*`, `WIFI_SESSION_SECRET` (signs the play
proof + reward QR, hashes devices/IPs), `ADMIN_PASSWORD` (`/admin/play` + staff
redemption). All optional in dev.

## Extension points (designed for, not yet built)

The architecture leaves clean seams for: the remaining games (Flip/Memory/Tap/
Daily Box — register + config), referrals (share already uses the play link),
seasonal campaigns (swap the `playwin` block on a schedule), leaderboards
(derive from `playwin_plays`), and push/WhatsApp reminders (a `notify` webhook
like the Review feature's).

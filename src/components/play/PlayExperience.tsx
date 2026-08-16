"use client";

// The Play & Win flow, top to bottom. A small, explicit state machine drives one
// glass card through: intro → pick a game → play → result → (claim) → reward.
// The games are the only thing that varies; everything around them — the frame,
// the transitions, the loss/blocked states — lives here so a new game only has
// to render itself and call onRevealed/onError.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, PartyPopper, RotateCcw } from "lucide-react";
import { business } from "@/lib/content";
import { Confetti } from "@/components/review/Confetti";
import { claimReward, playGame } from "@/lib/playwin/actions";
import type {
  ClaimResult,
  ClaimView,
  PublicGame,
  PublicSettings,
} from "@/lib/playwin/types";
import { GAME_REGISTRY, playableGames, type PlayFail, type PlaySuccess } from "./games/registry";
import { iconFor } from "./icons";
import { getDeviceId, getTable, newSessionId } from "./session";
import { ClaimForm } from "./ClaimForm";
import { RewardCard } from "./RewardCard";

type Phase = "intro" | "select" | "playing" | "result" | "claim" | "reward" | "blocked" | "error";

export function PlayExperience({ settings }: { settings: PublicSettings }) {
  const games = useMemo(() => playableGames(settings.games), [settings.games]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [game, setGame] = useState<PublicGame | null>(null);
  const [result, setResult] = useState<PlaySuccess | null>(null);
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [block, setBlock] = useState<PlayFail | null>(null);
  const [claiming, setClaiming] = useState(false);

  const reducedMotion = useReducedMotion();
  const identity = useRef({ deviceId: "", sessionId: "" });

  useEffect(() => {
    identity.current = { deviceId: getDeviceId(), sessionId: newSessionId() };
  }, []);

  function reset() {
    setGame(null);
    setResult(null);
    setClaim(null);
    setBlock(null);
    setPhase("select");
  }

  async function requestPlay() {
    return playGame({
      gameKey: game!.key,
      deviceId: identity.current.deviceId,
      sessionId: identity.current.sessionId,
      table: getTable(),
    });
  }

  function onRevealed(res: PlaySuccess) {
    setResult(res);
    setPhase("result");
  }

  function onError(res: PlayFail) {
    if (res.reason === "already_played") {
      setBlock(res);
      setPhase("blocked");
    } else {
      setBlock(res);
      setPhase("error");
    }
  }

  // Win reveal → move to capture (or straight to issue if contact isn't gated).
  async function proceedFromWin() {
    if (!result) return;
    if (settings.requireContactToClaim) {
      setPhase("claim");
      return;
    }
    setClaiming(true);
    const res = await issueClaim({ name: "", phone: "", whatsapp: "", birthday: "", email: "", marketingConsent: false });
    setClaiming(false);
    if (res.ok) {
      setClaim(res.claim);
      setPhase("reward");
    } else {
      setBlock({ ok: false, error: res.error, reason: "invalid" });
      setPhase("error");
    }
  }

  async function issueClaim(fields: {
    name: string;
    phone: string;
    whatsapp: string;
    birthday: string;
    email: string;
    marketingConsent: boolean;
  }): Promise<ClaimResult> {
    return claimReward({
      playId: result!.playId,
      playToken: result!.playToken,
      deviceId: identity.current.deviceId,
      sessionId: identity.current.sessionId,
      ...fields,
    });
  }

  const won = result?.win && result.reward.kind !== "none";

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center">
        <BackButton phase={phase} onBack={reset} />
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <div className="amb absolute left-[-20%] top-[20%] h-[56%] w-[140%]" aria-hidden />
        <div className="glass card-in relative overflow-hidden rounded-3xl p-6 sm:p-7">
          <div className="bord" aria-hidden />

          {phase === "intro" && (
            <Intro settings={settings} onStart={() => setPhase("select")} count={games.length} />
          )}

          {phase === "select" && (
            <GameSelect
              games={games}
              onPick={(g) => {
                setGame(g);
                setPhase("playing");
              }}
            />
          )}

          {phase === "playing" && game && <GameStage game={game} requestPlay={requestPlay} onRevealed={onRevealed} onError={onError} reducedMotion={reducedMotion} />}

          {phase === "result" && result && (
            <div className="step-in">
              {won ? (
                <WinReveal
                  title={result.reward.title}
                  description={result.reward.description}
                  color={result.reward.color}
                  icon={result.reward.icon}
                  busy={claiming}
                  reducedMotion={reducedMotion}
                  onClaim={proceedFromWin}
                />
              ) : (
                <LossReveal onBack={reset} hasMore={games.length > 1} />
              )}
            </div>
          )}

          {phase === "claim" && result && (
            <div className="step-in">
              <ClaimForm
                reward={result.reward}
                consentText={settings.marketingConsentText}
                onSubmit={issueClaim}
                onClaimed={(view) => {
                  setClaim(view);
                  setPhase("reward");
                }}
              />
            </div>
          )}

          {phase === "reward" && claim && (
            <div className="step-in">
              <RewardCard claim={claim} terms={settings.terms} />
            </div>
          )}

          {phase === "blocked" && block && (
            <BlockedState
              message={block.error}
              suggest={block.suggestGame ? games.find((g) => g.key === block.suggestGame) : undefined}
              onPickSuggested={(g) => {
                setGame(g);
                setBlock(null);
                setPhase("playing");
              }}
              onBack={reset}
            />
          )}

          {phase === "error" && block && (
            <ErrorState message={block.error} onRetry={reset} />
          )}
        </div>

        <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint">
          {business.name} · Aries Tap
        </p>
      </div>
    </div>
  );
}

// —————————————————————————————— sub-views

function Intro({ settings, onStart, count }: { settings: PublicSettings; onStart: () => void; count: number }) {
  return (
    <div className="pw-intro flex flex-col items-center py-6 text-center">
      <span className="pw-intro-badge flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <PartyPopper size={30} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-5 text-[30px] font-semibold tracking-[-0.03em]">{settings.headline}</h1>
      <p className="mt-2 max-w-xs text-[15px] text-ink-dim">{settings.subhead}</p>
      <button
        type="button"
        onClick={onStart}
        className="row mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg"
      >
        Start playing
      </button>
      <p className="mt-4 text-[12px] text-ink-faint">
        {count} game{count === 1 ? "" : "s"} · one win a day · win real rewards
      </p>
    </div>
  );
}

function GameSelect({ games, onPick }: { games: PublicGame[]; onPick: (g: PublicGame) => void }) {
  return (
    <div className="step-in">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Pick your game</h2>
      <p className="mt-1 text-[13px] text-ink-dim">One play each, per day. Choose wisely.</p>
      <div className="mt-5 flex flex-col gap-3">
        {games.map((g) => {
          const Icon = iconFor(g.icon);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => onPick(g)}
              className="row glass flex items-center gap-4 rounded-2xl px-4 py-4 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold tracking-[-0.01em]">{g.name}</span>
                <span className="block truncate text-[13px] text-ink-dim">{g.tagline}</span>
              </span>
              <ChevronRight size={18} strokeWidth={1.75} className="text-ink-faint" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GameStage({
  game,
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: {
  game: PublicGame;
  requestPlay: () => ReturnType<typeof playGame>;
  onRevealed: (r: PlaySuccess) => void;
  onError: (r: PlayFail) => void;
  reducedMotion: boolean;
}) {
  const Game = GAME_REGISTRY[game.key];
  if (!Game) return null;
  return (
    <div className="step-in">
      <h2 className="mb-6 text-center text-[20px] font-semibold tracking-[-0.02em]">{game.name}</h2>
      <Game game={game} requestPlay={requestPlay} onRevealed={onRevealed} onError={onError} reducedMotion={reducedMotion} />
    </div>
  );
}

function WinReveal({
  title,
  description,
  color,
  icon,
  busy,
  reducedMotion,
  onClaim,
}: {
  title: string;
  description: string;
  color: string;
  icon: string;
  busy: boolean;
  reducedMotion: boolean;
  onClaim: () => void;
}) {
  const Icon = iconFor(icon);
  return (
    <div className="relative flex flex-col items-center py-4 text-center">
      <Confetti fire={!reducedMotion} />
      <span
        className="pw-reward-badge flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{ background: `${color}22`, color }}
      >
        <Icon size={38} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">You won</p>
      <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.03em]">{title}</h2>
      <p className="mt-1 max-w-xs text-[14px] text-ink-dim">{description}</p>
      <button
        type="button"
        onClick={onClaim}
        disabled={busy}
        className="row mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg disabled:opacity-50"
      >
        {busy ? "Unlocking…" : "Claim my reward"}
      </button>
    </div>
  );
}

function LossReveal({ onBack, hasMore }: { onBack: () => void; hasMore: boolean }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--press)] text-ink-dim">
        <RotateCcw size={28} strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">So close!</h2>
      <p className="mt-1 max-w-xs text-[14px] text-ink-dim">
        No prize this time. {hasMore ? "Try another game today, or come" : "Come"} back tomorrow for another go.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="row mt-7 flex h-12 w-full items-center justify-center rounded-2xl border border-line text-[15px] font-semibold"
      >
        {hasMore ? "Try another game" : "Back to games"}
      </button>
    </div>
  );
}

function BlockedState({
  message,
  suggest,
  onPickSuggested,
  onBack,
}: {
  message: string;
  suggest?: PublicGame;
  onPickSuggested: (g: PublicGame) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <PartyPopper size={28} strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Already played today</h2>
      <p className="mt-1 max-w-xs text-[14px] text-ink-dim">{message}</p>
      {suggest ? (
        <button
          type="button"
          onClick={() => onPickSuggested(suggest)}
          className="row mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg"
        >
          Try {suggest.name} instead
        </button>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="row mt-7 flex h-12 w-full items-center justify-center rounded-2xl border border-line text-[15px] font-semibold"
        >
          Back to games
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">One moment</h2>
      <p className="mt-1 max-w-xs text-[14px] text-ink-dim">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="row mt-7 flex h-12 w-full items-center justify-center rounded-2xl border border-line text-[15px] font-semibold"
      >
        Back to games
      </button>
    </div>
  );
}

function BackButton({ phase, onBack }: { phase: Phase; onBack: () => void }) {
  const cls = "row -ml-2 flex h-10 w-10 items-center justify-center rounded-full";
  // From the first screens, back leaves Play & Win; from deeper in, back returns
  // to game selection.
  if (phase === "intro" || phase === "select") {
    return (
      <Link href="/" aria-label="Back" className={cls}>
        <ArrowLeft size={20} strokeWidth={1.75} className="text-ink-dim" aria-hidden />
      </Link>
    );
  }
  return (
    <button type="button" aria-label="Back to games" className={cls} onClick={onBack}>
      <ArrowLeft size={20} strokeWidth={1.75} className="text-ink-dim" aria-hidden />
    </button>
  );
}

function useReducedMotion(): boolean {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRm(m.matches);
    const handler = () => setRm(m.matches);
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, []);
  return rm;
}

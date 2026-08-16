"use client";

// Tap Challenge. Hit the moving target enough times before the clock runs out to
// unlock your daily reward. The skill gates the *reveal*, not the prize: the
// server draw (requestPlay) happens only on success, so a client can't grind
// attempts for a better reward, and a failed run costs no play at all.

import { useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import type { GameComponentProps } from "./registry";

const TARGET_TAPS = 6;
const DURATION = 12; // seconds

type Phase = "idle" | "playing" | "won" | "failed";

export function TapChallenge({
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [pos, setPos] = useState({ x: 50, y: 45 });

  const timer = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => () => stopTimer(), []);

  function stopTimer() {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }

  function reposition() {
    setPos({ x: 10 + Math.random() * 76, y: 10 + Math.random() * 68 });
  }

  function start() {
    setPhase("playing");
    setScore(0);
    setTimeLeft(DURATION);
    reposition();
    stopTimer();
    timer.current = window.setInterval(() => {
      setTimeLeft((t) => {
        const next = Math.round((t - 0.1) * 10) / 10;
        if (next <= 0) {
          stopTimer();
          setPhase("failed");
          return 0;
        }
        return next;
      });
    }, 100);
  }

  async function hit() {
    if (phase !== "playing") return;
    const next = score + 1;
    setScore(next);
    if (next >= TARGET_TAPS) {
      stopTimer();
      setPhase("won");
      if (busy.current) return;
      busy.current = true;
      const res = await requestPlay();
      if (!res.ok) {
        onError(res);
        return;
      }
      window.setTimeout(() => onRevealed(res), reducedMotion ? 250 : 650);
    } else {
      reposition();
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex w-full max-w-sm items-center justify-between text-[13px]">
        <span className="text-ink-dim">
          Hits <span className="font-semibold text-ink tabular-nums">{score}/{TARGET_TAPS}</span>
        </span>
        <span className={`tabular-nums font-semibold ${timeLeft <= 3 ? "text-danger" : "text-ink-dim"}`}>
          {timeLeft.toFixed(1)}s
        </span>
      </div>

      <div className="pw-tap-arena relative w-full max-w-sm overflow-hidden rounded-3xl">
        {phase === "playing" && (
          <button
            type="button"
            onPointerDown={hit}
            aria-label="Tap the target"
            className="pw-tap-target"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transition: reducedMotion ? "none" : "left 120ms ease, top 120ms ease",
            }}
          >
            <Target size={26} strokeWidth={2} aria-hidden />
          </button>
        )}

        {phase === "idle" && (
          <Overlay>
            <button type="button" onClick={start} className="pw-tap-start">
              Start
            </button>
            <p className="mt-3 text-[13px] text-ink-dim">
              Tap the target {TARGET_TAPS}× before the clock runs out.
            </p>
          </Overlay>
        )}

        {phase === "failed" && (
          <Overlay>
            <p className="text-[18px] font-semibold tracking-[-0.01em]">Out of time!</p>
            <p className="mt-1 text-[13px] text-ink-dim">No play used — give it another go.</p>
            <button type="button" onClick={start} className="pw-tap-start mt-4">
              Try again
            </button>
          </Overlay>
        )}

        {phase === "won" && (
          <Overlay>
            <p className="text-[18px] font-semibold tracking-[-0.01em]">Nailed it!</p>
            <p className="mt-1 text-[13px] text-ink-dim">Unlocking your reward…</p>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

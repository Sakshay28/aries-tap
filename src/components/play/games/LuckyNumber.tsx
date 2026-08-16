"use client";

// Lucky Number — a rolling draw that decelerates onto the guest's number. As
// with every game, the server has already decided the reward; the number we land
// on is chosen to sit in that winning slot's band, so the reveal is honest.

import { useRef, useState } from "react";
import type { GameComponentProps } from "./registry";

export function LuckyNumber({
  game,
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  const n = game.slots.length;
  const [display, setDisplay] = useState(7);
  const [rolling, setRolling] = useState(false);
  const busy = useRef(false);

  async function draw() {
    if (busy.current) return;
    busy.current = true;
    setRolling(true);

    const res = await requestPlay();
    if (!res.ok) {
      setRolling(false);
      busy.current = false;
      onError(res);
      return;
    }

    // A number in this slot's band of 1–99 — cosmetic, but consistent.
    const band = 99 / n;
    const final = Math.max(1, Math.min(99, Math.round(res.resultIndex * band + Math.random() * band)));

    if (reducedMotion) {
      setDisplay(final);
      window.setTimeout(() => {
        setRolling(false);
        onRevealed(res);
      }, 400);
      return;
    }

    // Decelerating roll: ticks start fast (~45ms) and stretch toward ~240ms.
    const start = performance.now();
    const duration = 2000;
    const step = () => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) {
        setDisplay(final);
        window.setTimeout(() => {
          setRolling(false);
          onRevealed(res);
        }, 550);
        return;
      }
      setDisplay(1 + Math.floor(Math.random() * 99));
      // ease-out: delay grows with t
      const delay = 45 + t * t * 200;
      window.setTimeout(step, delay);
    };
    step();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="pw-lucky glass relative flex aspect-square w-full max-w-[15rem] items-center justify-center rounded-3xl">
        <div className="bord" aria-hidden />
        <span
          className="text-[86px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-accent"
          style={{ textShadow: "0 6px 24px color-mix(in srgb, var(--accent) 40%, transparent)" }}
        >
          {String(display).padStart(2, "0")}
        </span>
      </div>

      <button
        type="button"
        onClick={draw}
        disabled={rolling}
        className="row mt-7 flex h-12 w-full max-w-[15rem] items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg disabled:opacity-50"
      >
        {rolling ? <span className="pw-spinner pw-spinner-dark" aria-hidden /> : "DRAW MY NUMBER"}
      </button>
      <p className="mt-4 text-center text-[13px] text-ink-dim">
        {rolling ? "Finding your number…" : "One draw. Land in a winning range."}
      </p>
    </div>
  );
}

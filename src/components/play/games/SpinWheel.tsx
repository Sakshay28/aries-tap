"use client";

// Spin the Wheel. The outcome is NOT decided here — requestPlay() runs the
// authoritative server draw and returns the winning slot index; this component
// simply spins the wheel so that segment lands under the pointer. The animation
// is theatre over a result that's already true and signed.

import { useRef, useState } from "react";
import { iconFor } from "../icons";
import type { GameComponentProps } from "./registry";

// Point on the wheel rim at a clockwise angle (degrees) from the top.
function xy(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180; // -90 so 0° is the top
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const [sx, sy] = xy(cx, cy, r, start);
  const [ex, ey] = xy(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
}

export function SpinWheel({
  game,
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  const slots = game.slots;
  const n = slots.length;
  const seg = 360 / n;

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pending = useRef<Parameters<typeof onRevealed>[0] | null>(null);
  const revealed = useRef(false);
  const busy = useRef(false);

  // One reveal per spin, whichever fires first: the CSS transitionend, or a
  // safety timer. The timer matters because a backgrounded tab (or a flaky
  // renderer) may never dispatch transitionend — a game must never hang.
  function reveal() {
    if (revealed.current || !pending.current) return;
    revealed.current = true;
    const res = pending.current;
    pending.current = null;
    setSpinning(false);
    onRevealed(res);
  }

  async function spin() {
    if (busy.current) return;
    busy.current = true;
    revealed.current = false;
    setSpinning(true);

    const res = await requestPlay();
    if (!res.ok) {
      setSpinning(false);
      busy.current = false;
      onError(res);
      return;
    }

    // Land segment `resultIndex` under the top pointer, after a few full turns,
    // with a little off-center jitter so it never stops dead straight.
    const mid = res.resultIndex * seg + seg / 2;
    const jitter = (Math.random() - 0.5) * seg * 0.3;
    const desired = (((-mid - jitter) % 360) + 360) % 360;
    const current = ((rotation % 360) + 360) % 360;
    let delta = desired - current;
    if (delta < 0) delta += 360;
    const next = rotation + 360 * 5 + delta;

    pending.current = res;
    setRotation(next);

    // Reduced motion → reveal almost immediately; otherwise a fallback just
    // past the 4.6s transition guarantees the reveal even if the event is lost.
    window.setTimeout(reveal, reducedMotion ? 350 : 4900);
  }

  function handleTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== "transform") return;
    reveal();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
        {/* Pointer */}
        <div className="pw-wheel-pointer" aria-hidden />

        {/* Rotating group: SVG color slices + overlaid radial labels */}
        <div
          className="absolute inset-0"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition:
              spinning && !reducedMotion
                ? "transform 4.6s cubic-bezier(0.12, 0.72, 0.12, 1)"
                : "none",
            willChange: "transform",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full pw-wheel-svg">
            {slots.map((s, i) => (
              <path
                key={i}
                d={slicePath(100, 100, 98, i * seg, (i + 1) * seg)}
                fill={s.color}
                fillOpacity={0.9}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={0.5}
              />
            ))}
            <circle cx="100" cy="100" r="98" fill="none" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1.5" />
          </svg>

          {slots.map((s, i) => {
            const Icon = iconFor(s.icon);
            const mid = i * seg + seg / 2;
            return (
              <div
                key={i}
                className="pw-wheel-label"
                style={{ transform: `translate(-50%, -50%) rotate(${mid}deg) translateY(-6.1rem)` }}
              >
                <Icon size={18} strokeWidth={2} className="text-[#0b0b0a]" aria-hidden />
                <span className="pw-wheel-label-text">{shortLabel(s.title)}</span>
              </div>
            );
          })}
        </div>

        {/* Center hub / spin button */}
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          aria-label={spinning ? "Spinning" : "Spin the wheel"}
          className="pw-wheel-hub"
        >
          {spinning ? <span className="pw-spinner" aria-hidden /> : "SPIN"}
        </button>
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-dim">
        {spinning ? "Good luck…" : "Tap SPIN — one spin, one prize."}
      </p>
    </div>
  );
}

// Keep wheel text to a word or two so segments stay legible.
function shortLabel(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  return t.length > 12 ? t.slice(0, 11) + "…" : t;
}

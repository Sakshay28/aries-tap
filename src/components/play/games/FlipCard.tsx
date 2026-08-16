"use client";

// Flip the Card. Three cards face down; the guest picks one and it flips to the
// reward the server drew. The other two flip a beat later to a random near-miss
// — theatre only. Which card they pick has no effect on the (server-decided)
// outcome; it's a luck reveal, like the wheel or the scratch card.

import { useMemo, useRef, useState } from "react";
import { Confetti } from "@/components/review/Confetti";
import { iconFor } from "../icons";
import type { PublicReward } from "@/lib/playwin/types";
import type { GameComponentProps, PlaySuccess } from "./registry";

export function FlipCard({
  game,
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  const [result, setResult] = useState<PlaySuccess | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const busy = useRef(false);

  // Distinct rewards to show on the two cards the guest doesn't pick.
  const decoys = useMemo(() => {
    const seen = new Set<string>();
    const uniq: PublicReward[] = [];
    for (const s of game.slots) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        uniq.push(s);
      }
    }
    return uniq;
  }, [game.slots]);

  async function pick(i: number) {
    if (busy.current || picked !== null) return;
    busy.current = true;
    const res = await requestPlay();
    if (!res.ok) {
      busy.current = false;
      onError(res);
      return;
    }
    setResult(res);
    setPicked(i);
    setRevealed(true);
    window.setTimeout(() => onRevealed(res), reducedMotion ? 500 : 1400);
  }

  // What each card shows once flipped: the picked card = the real reward; the
  // others = decoys that aren't the winning reward.
  function faceFor(i: number): PublicReward {
    if (result && i === picked) return result.reward;
    const pool = decoys.filter((d) => d.id !== result?.reward.id);
    return pool[i % Math.max(1, pool.length)] ?? game.slots[0];
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid w-full max-w-sm grid-cols-3 gap-3">
        {result && <Confetti fire={revealed && result.win && !reducedMotion} />}
        {[0, 1, 2].map((i) => {
          const reward = faceFor(i);
          const Icon = iconFor(reward.icon);
          const isFlipped = revealed;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={picked !== null}
              className="pw-flip-scene"
              aria-label={`Flip card ${i + 1}`}
            >
              <div
                className="pw-flip"
                data-flipped={isFlipped}
                style={{ transitionDelay: reducedMotion ? "0ms" : i === picked ? "0ms" : "500ms" }}
              >
                <div className="pw-flip-face pw-flip-front">
                  <span className="pw-flip-mark">?</span>
                </div>
                <div
                  className="pw-flip-face pw-flip-back"
                  style={{ color: reward.color, borderColor: `${reward.color}55` }}
                >
                  <Icon size={26} strokeWidth={1.75} aria-hidden />
                  <span className="pw-flip-title">{reward.title}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-center text-[13px] text-ink-dim">
        {picked !== null ? "Nice pick." : "Tap a card to flip it."}
      </p>
    </div>
  );
}

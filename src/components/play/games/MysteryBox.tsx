"use client";

// Daily Mystery Box. The repeat-visit hook — one box every 24h. Tap it, the lid
// bursts open over a light bloom, and the flow hands off to the reward reveal.
// As always, the prize is drawn and signed server-side on the tap; the box is
// the wrapping paper.

import { useRef, useState } from "react";
import { Gift } from "lucide-react";
import { Confetti } from "@/components/review/Confetti";
import type { GameComponentProps, PlaySuccess } from "./registry";

export function MysteryBox({
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PlaySuccess | null>(null);
  const busy = useRef(false);

  async function openBox() {
    if (busy.current) return;
    busy.current = true;
    const res = await requestPlay();
    if (!res.ok) {
      busy.current = false;
      onError(res);
      return;
    }
    setResult(res);
    setOpen(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(14);
    window.setTimeout(() => onRevealed(res), reducedMotion ? 350 : 1300);
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={openBox}
        disabled={open}
        aria-label="Open the mystery box"
        className="pw-box-btn relative"
      >
        {result && <Confetti fire={open && result.win && !reducedMotion} />}
        <div className="pw-box" data-open={open}>
          <div className="pw-box-glow" aria-hidden />
          <div className="pw-box-body">
            <Gift size={40} strokeWidth={1.5} aria-hidden />
          </div>
          <div className="pw-box-lid" aria-hidden />
        </div>
      </button>

      <p className="mt-8 text-center text-[13px] text-ink-dim">
        {open ? "Opening…" : "Tap the box to open today's mystery."}
      </p>
    </div>
  );
}

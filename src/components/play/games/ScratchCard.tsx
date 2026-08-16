"use client";

// Scratch Card. The play is consumed only on the *first scratch* (so opening the
// card and walking away never burns the guest's daily play), then the server's
// result is placed under the foil and revealed as they scratch through it. A
// Reveal button provides a no-drag path for keyboard / reduced-motion users.

import { useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/review/Confetti";
import { iconFor } from "../icons";
import type { GameComponentProps, PlaySuccess } from "./registry";

export function ScratchCard({
  game,
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  void game;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const started = useRef(false);
  const finished = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const resultRef = useRef<PlaySuccess | null>(null);

  const [result, setResult] = useState<PlaySuccess | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loadingPlay, setLoadingPlay] = useState(false);

  // Paint the gold foil over the card.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#b98d4e");
    grad.addColorStop(0.45, "#e6cd97");
    grad.addColorStop(0.55, "#c8a76e");
    grad.addColorStop(1, "#9c7b45");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(11,11,10,0.42)";
    ctx.font = "600 15px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Scratch to reveal your prize", W / 2, H / 2);
  }, []);

  // Ensure the play is requested exactly once, on first interaction.
  async function ensurePlay() {
    if (started.current) return;
    started.current = true;
    setLoadingPlay(true);
    const res = await requestPlay();
    setLoadingPlay(false);
    if (!res.ok) {
      onError(res);
      return;
    }
    resultRef.current = res;
    setResult(res);
  }

  function pointFromEvent(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function scratchAt(x: number, y: number) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 44;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    last.current = { x, y };
  }

  function clearedFraction(): number {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return 0;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let clear = 0;
    let total = 0;
    // Sample every ~16th pixel for speed.
    for (let i = 3; i < data.length; i += 64) {
      total++;
      if (data[i] === 0) clear++;
    }
    return total ? clear / total : 0;
  }

  function finish() {
    if (finished.current || !resultRef.current) return;
    finished.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setRevealed(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
    window.setTimeout(() => onRevealed(resultRef.current as PlaySuccess), 1100);
  }

  async function onPointerDown(e: React.PointerEvent) {
    if (finished.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    await ensurePlay();
    drawing.current = true;
    last.current = null;
    const { x, y } = pointFromEvent(e);
    scratchAt(x, y);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current || finished.current) return;
    const { x, y } = pointFromEvent(e);
    scratchAt(x, y);
    if (resultRef.current && clearedFraction() > 0.5) finish();
  }

  function onPointerUp() {
    drawing.current = false;
    last.current = null;
  }

  // Reveal button — instant path for keyboard / reduced-motion / "just show me".
  async function revealNow() {
    if (finished.current) return;
    await ensurePlay();
    if (resultRef.current) finish();
  }

  const reward = result?.reward;

  return (
    <div className="flex flex-col items-center">
      <div className="pw-scratch relative aspect-[16/10] w-full max-w-sm overflow-hidden rounded-3xl">
        {/* The prize underneath */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          {reward ? (
            <>
              <span
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: `${reward.color}22`, color: reward.color }}
              >
                {(() => {
                  const Icon = iconFor(reward.icon);
                  return <Icon size={30} strokeWidth={1.75} aria-hidden />;
                })()}
              </span>
              <p className="text-[22px] font-semibold tracking-[-0.02em]">{reward.title}</p>
              <p className="text-[13px] text-ink-dim">{reward.description}</p>
            </>
          ) : (
            <span className="pw-scratch-shimmer" aria-hidden />
          )}
        </div>

        {/* The foil */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ opacity: revealed ? 0 : 1, transition: "opacity 500ms ease" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="Scratch card"
        />

        <Confetti fire={revealed && !reducedMotion} />
      </div>

      <button
        type="button"
        onClick={revealNow}
        disabled={finished.current || loadingPlay}
        className="row mt-6 rounded-full border border-line px-5 py-2 text-[13px] font-medium text-ink-dim disabled:opacity-40"
      >
        {loadingPlay ? "Revealing…" : "Reveal instantly"}
      </button>
    </div>
  );
}

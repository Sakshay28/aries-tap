"use client";

import { useEffect, useRef } from "react";

// A quiet, expensive-looking celebration — not a rainbow explosion. Warm golds
// and cream on a device-pixel-ratio canvas, a single burst that falls and fades
// in ~2.6s. Pure canvas (no dependency), cleans up its own RAF loop, and does
// nothing at all when the guest prefers reduced motion.

const COLORS = ["#c8a76e", "#e0c28c", "#f4f1ea", "#b98d4e", "#efd9a6"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
};

export function Confetti({ fire }: { fire: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!fire) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Two soft fountains from the lower corners plus a light rain from the top —
    // reads as celebratory without covering the message.
    const pieces: Piece[] = [];
    const make = (x: number, y: number, vx: number, vy: number) => ({
      x,
      y,
      vx,
      vy,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 1,
    });
    for (let i = 0; i < 70; i++) {
      pieces.push(make(W * 0.5, H * 0.42, (Math.random() - 0.5) * 9, -6 - Math.random() * 7));
    }
    for (let i = 0; i < 40; i++) {
      pieces.push(make(Math.random() * W, -20, (Math.random() - 0.5) * 2, 2 + Math.random() * 3));
    }

    const gravity = 0.16;
    let frame = 0;
    const maxFrames = 160;

    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        p.vy += gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (frame > maxFrames * 0.55) p.life -= 0.02;

        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (frame < maxFrames) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [fire]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}

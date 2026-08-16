"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Depth layer for the hero photograph: the background drifts a few pixels
// against pointer position (desktop) or device tilt (mobile) while the card
// stays put, so the page reads as physical layers. Input is lerped inside a
// single rAF loop that stops the moment the motion settles — idle cost zero.
// The wrapper bleeds 12px past the viewport so the shift never exposes edges.

const RANGE_X = 8;
const RANGE_Y = 6;

export function ParallaxLayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const tick = () => {
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / innerWidth - 0.5) * -2 * RANGE_X;
      targetY = (e.clientY / innerHeight - 0.5) * -2 * RANGE_Y;
      schedule();
    };

    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      targetX = Math.max(-1, Math.min(1, e.gamma / 30)) * -RANGE_X;
      targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * -RANGE_Y;
      schedule();
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="absolute -inset-3 will-change-transform">
      {children}
    </div>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";

// Scroll choreography driver: adds `in` once the element enters the viewport,
// then disconnects. The actual motion lives entirely in CSS (globals.css),
// so this is the only JavaScript the scroll experience pays for.

type Variant = "rise" | "scale" | "mask" | "mask-r" | "stagger";

export function Reveal({
  variant = "rise",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      // Near-zero threshold: variants that start clip-path-hidden (mask)
      // report a tiny intersection ratio, so a higher threshold would never
      // fire for them. The negative bottom margin keeps the "properly on
      // screen before it moves" feel instead.
      { threshold: 0.01, rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={clsx("rv", `rv-${variant}`, className)}>
      {children}
    </div>
  );
}

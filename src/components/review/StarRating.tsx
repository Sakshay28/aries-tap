"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Rating } from "@/lib/review/types";

// Five large stars. A proper radiogroup: arrow keys and 1–5 move the selection,
// each star is an aria-checkable radio, and VoiceOver announces "3 of 5 stars".
// Hover/press previews the fill; the chosen star springs as it locks in. Fill
// and glow are the only colour the component introduces — the app's gold accent.

const LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: Rating | 0;
  onChange: (r: Rating) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  function select(r: Rating) {
    if (disabled) return;
    haptic();
    onChange(r);
  }

  function onKey(e: React.KeyboardEvent, index: Rating) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(5, (value || index) + 1) as Rating;
      setHover(0);
      select(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const prev = Math.max(1, (value || index) - 1) as Rating;
      setHover(0);
      select(prev);
    } else if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      setHover(0);
      select(Number(e.key) as Rating);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        role="radiogroup"
        aria-label="Rate your experience from 1 to 5 stars"
        className="flex items-center gap-2 sm:gap-3"
        onPointerLeave={() => setHover(0)}
      >
        {([1, 2, 3, 4, 5] as Rating[]).map((i) => {
          const active = i <= shown;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={`${i} ${i === 1 ? "star" : "stars"} — ${LABELS[i - 1]}`}
              tabIndex={value ? (value === i ? 0 : -1) : i === 1 ? 0 : -1}
              disabled={disabled}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(0)}
              onClick={() => select(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "rv-star grid h-12 w-12 place-items-center rounded-2xl outline-none sm:h-14 sm:w-14 transition-transform",
                "focus-visible:ring-2 focus-visible:ring-[#b89b5e]/60 hover:bg-[#b89b5e]/10",
                active ? "rv-star-on" : "rv-star-off",
                value === i && "rv-star-pick"
              )}
            >
              <Star
                className={cn(
                  "h-8 w-8 transition-colors duration-200 sm:h-9 sm:w-9",
                  active ? "text-[#b89b5e]" : "text-[#d6d0c7]"
                )}
                strokeWidth={1.5}
                fill={active ? "currentColor" : "none"}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {/* Reserve the line's height so selecting a star never shifts layout. */}
      <p
        className="mt-3 h-5 text-[14px] font-semibold tracking-[-0.01em] text-[#8a6d39] transition-opacity duration-200"
        aria-live="polite"
      >
        {shown ? LABELS[shown - 1] : " "}
      </p>
    </div>
  );
}

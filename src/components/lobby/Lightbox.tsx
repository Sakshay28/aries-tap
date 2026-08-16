"use client";

import { useCallback, useEffect } from "react";
import Image, { type StaticImageData } from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type Photo = { image: StaticImageData; alt: string };

// A calm full-screen viewer. `object-contain` inside a viewport-bounded box so
// portrait and landscape shots are both shown whole — never cropped, never
// spilling. Esc closes, ← → step, the page behind it can't scroll.

export function Lightbox({
  photos,
  index,
  label,
  onClose,
  onIndex,
}: {
  photos: Photo[];
  index: number | null;
  label: string;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const step = useCallback(
    (dir: number) => {
      if (index === null) return;
      onIndex((index + dir + photos.length) % photos.length);
    },
    [index, photos.length, onIndex]
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, onClose, step]);

  if (index === null) return null;
  const current = photos[index];

  return (
    <div
      className="lb-lightbox fixed inset-0 z-50 flex flex-col items-center justify-center px-4 py-[max(3.5rem,env(safe-area-inset-top))]"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-sm transition hover:bg-white/20"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>

      <div
        className="relative flex min-h-0 w-full max-w-[860px] flex-1 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={current.image}
          alt={current.alt}
          quality={100}
          placeholder="blur"
          sizes="(max-width: 860px) 92vw, 860px"
          className="max-h-full w-auto rounded-xl object-contain"
        />
      </div>

      <p className="mt-4 shrink-0 text-center text-[12.5px] font-medium text-white/70">
        {current.alt}
      </p>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-sm transition hover:bg-white/20"
          >
            <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-sm transition hover:bg-white/20"
          >
            <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
          </button>
          <div className="mt-1 shrink-0 text-[12px] font-semibold tabular-nums tracking-[0.1em] text-white/50">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}

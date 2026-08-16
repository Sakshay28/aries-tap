"use client";

import { useEffect } from "react";
import {
  UtensilsCrossed,
  Martini,
  Wine,
  ArrowUpRight,
  X,
  type LucideIcon,
} from "lucide-react";
import type { MenuIconKey, VenueMenu } from "@/lib/content";

// The menu picker. A venue with more than one menu can't just link a card, so
// the card opens this: a quiet sheet that names each menu and hands off to the
// device's own PDF viewer, where pinch-zoom already works properly.

const icons: Record<MenuIconKey, LucideIcon> = {
  food: UtensilsCrossed,
  cocktails: Martini,
  spirits: Wine,
};

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(6);
  }
}

export function MenuSheet({
  venueName,
  menus,
  open,
  onClose,
}: {
  venueName: string;
  menus: VenueMenu[];
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lb-lightbox fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${venueName} menus`}
      onClick={onClose}
    >
      <div
        className="lb-sheet w-full max-w-[440px] rounded-t-[24px] bg-[color:var(--lb-bg)] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[24px] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="text-left">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[color:var(--lb-faint)]">
              {venueName}
            </p>
            <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-[color:var(--lb-ink)]">
              Menus
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--lb-dim)] transition hover:bg-[color:var(--lb-press)]"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {menus.map((m) => {
            const Icon = icons[m.icon];
            return (
              <a
                key={m.href}
                href={m.href}
                target="_blank"
                rel="noopener noreferrer"
                className="lb-menu-row group flex items-center gap-3.5 rounded-2xl p-3.5 text-left no-underline"
                onPointerDown={haptic}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)]">
                  <Icon
                    size={18}
                    strokeWidth={1.5}
                    className="text-[color:var(--lb-gold-ink)]"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-[color:var(--lb-ink)]">
                    {m.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-[color:var(--lb-dim)]">
                    {m.note}
                  </span>
                </span>
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.75}
                  className="lb-menu-arrow shrink-0 text-[color:var(--lb-faint)]"
                  aria-hidden
                />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

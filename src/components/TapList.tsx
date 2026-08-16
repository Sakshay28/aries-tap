"use client";

import { type PointerEvent as ReactPointerEvent } from "react";
import {
  UtensilsCrossed,
  BadgePercent,
  Camera,
  Star,
  Wifi,
  Gamepad2,
  MessageCircle,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { actions, business, type Action, type ActionKey } from "@/lib/content";
import { openReview } from "@/components/review/events";

const icons: Record<ActionKey, LucideIcon> = {
  menu: UtensilsCrossed,
  offers: BadgePercent,
  instagram: Camera,
  review: Star,
  wifi: Wifi,
  play: Gamepad2,
  ai: MessageCircle,
};

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(6);
  }
}

// Gold bloom from the exact touch point; removes itself after the animation.
function spawnRipple(e: ReactPointerEvent<HTMLElement>) {
  const row = e.currentTarget;
  const rect = row.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "ripple";
  dot.style.left = `${e.clientX - rect.left}px`;
  dot.style.top = `${e.clientY - rect.top}px`;
  row.appendChild(dot);
  dot.addEventListener("animationend", () => dot.remove(), { once: true });
}

function press(e: ReactPointerEvent<HTMLElement>) {
  haptic();
  spawnRipple(e);
}

const rowClass =
  "row relative overflow-hidden flex w-full items-center gap-5 rounded-2xl px-5 text-left flex-1 min-h-14 max-h-24 cursor-pointer select-none";

const iconClass = "row-icon shrink-0 text-accent";

export function TapList() {
  function renderRow(action: Action) {
    const Icon = icons[action.key];
    const inner = (
      <>
        <Icon size={24} strokeWidth={1.75} className={iconClass} aria-hidden />
        <span className="row-label text-[17px] font-medium tracking-[-0.01em]">
          {action.label}
        </span>
        <ChevronRight
          size={18}
          strokeWidth={1.75}
          className="row-arrow ml-auto text-ink-dim"
          aria-hidden
        />
      </>
    );

    // The review row is not a link: it opens the Review Experience modal, which
    // routes happy guests to Google and unhappy ones to private feedback.
    if (action.key === "review") {
      return (
        <button
          key={action.key}
          type="button"
          data-key={action.key}
          className={rowClass}
          onPointerDown={press}
          onClick={openReview}
        >
          {inner}
        </button>
      );
    }

    // Full URLs and file links (e.g. the menu PDF) open in a new tab so the
    // guest never loses the microsite; in-page anchors stay in place.
    const newTab = action.href.startsWith("http") || action.href.endsWith(".pdf");
    return (
      <a
        key={action.key}
        href={action.href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
        data-key={action.key}
        className={rowClass}
        onPointerDown={press}
      >
        {inner}
      </a>
    );
  }

  return (
    <nav aria-label={`${business.name} actions`} className="rise-list flex flex-1 flex-col">
      {actions.map((action, i) => (
        <div key={action.key} className="flex flex-1 flex-col">
          {i > 0 && <div className="mx-5 h-px bg-line" aria-hidden />}
          {renderRow(action)}
        </div>
      ))}
    </nav>
  );
}

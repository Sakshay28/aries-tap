"use client";

import { type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  Star,
  ScrollText,
  Wifi,
  Camera,
  Sparkles,
  Images,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import type { LobbyAction, LobbyIconKey } from "@/lib/content";
import { openReview } from "@/components/review/events";
import { openTaffetaStory } from "@/components/lobby/events";

const icons: Record<LobbyIconKey, LucideIcon> = {
  review: Star,
  menu: ScrollText,
  wifi: Wifi,
  instagram: Camera,
  ai: Sparkles,
  gallery: Images,
  story: BookOpen,
};

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(6);
  }
}

function spawnRipple(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "ripple";
  dot.style.left = `${e.clientX - rect.left}px`;
  dot.style.top = `${e.clientY - rect.top}px`;
  el.appendChild(dot);
  dot.addEventListener("animationend", () => dot.remove(), { once: true });
}

function press(e: ReactPointerEvent<HTMLElement>) {
  haptic();
  spawnRipple(e);
}

// A clean white card: a centred outline icon, a title, and an optional small
// subtitle beneath it.
const cardClass =
  "lb-card group flex min-h-[92px] flex-col items-center justify-center gap-2 px-1.5 py-3.5 text-center no-underline select-none cursor-pointer";

export function ActionCard({
  action,
  breatheDelay,
}: {
  action: LobbyAction;
  // Phase offset (s) for the icon's 7s breathing cycle, so the five
  // icons never move in unison.
  breatheDelay?: number;
}) {
  const Icon = icons[action.icon];

  const inner = (
    <>
      <span
        className="lb-ico-wrap"
        style={breatheDelay ? { animationDelay: `${breatheDelay}s` } : undefined}
      >
        <Icon
          size={20}
          strokeWidth={1.5}
          className="lb-ico text-[color:var(--lb-gold-ink)]"
          aria-hidden
        />
      </span>
      <div>
        <h3 className="text-[12.5px] font-semibold leading-[1.25] tracking-[-0.01em] text-[color:var(--lb-ink)]">
          {action.label}
        </h3>
        {action.hint && (
          <p className="mt-0.5 text-[9.5px] font-medium leading-none text-[color:var(--lb-faint)]">
            {action.hint}
          </p>
        )}
      </div>
    </>
  );

  if (action.kind === "review") {
    return (
      <button
        type="button"
        data-key={action.key}
        aria-label={action.label}
        className={clsx(cardClass)}
        onPointerDown={press}
        onClick={openReview}
      >
        {inner}
      </button>
    );
  }

  if (action.kind === "gallery") {
    return (
      <Link
        href={action.href && action.href !== "#gallery" ? action.href : "/gallery?venue=taffeta"}
        data-key={action.key}
        aria-label={action.label}
        className={clsx(cardClass)}
        onPointerDown={press}
      >
        {inner}
      </Link>
    );
  }

  if (action.kind === "story") {
    return (
      <button
        type="button"
        data-key={action.key}
        aria-label={action.label}
        className={clsx(cardClass)}
        onPointerDown={press}
        onClick={openTaffetaStory}
      >
        {inner}
      </button>
    );
  }

  const newTab = action.href.startsWith("http") || action.href.endsWith(".pdf");

  if (!newTab && action.href.startsWith("/")) {
    return (
      <Link
        href={action.href}
        data-key={action.key}
        aria-label={action.label}
        className={clsx(cardClass)}
        onPointerDown={press}
      >
        {inner}
      </Link>
    );
  }

  return (
    <a
      href={action.href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      data-key={action.key}
      aria-label={action.label}
      className={clsx(cardClass)}
      onPointerDown={press}
    >
      {inner}
    </a>
  );
}

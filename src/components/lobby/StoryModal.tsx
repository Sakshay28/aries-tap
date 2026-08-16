"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  X,
  Award,
  Sparkles,
  Coffee,
  MapPin,
  Clock,
  Flame,
  Cake,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  Compass,
} from "lucide-react";
import { taffetaStory, taffeta, family, location, business } from "@/lib/content";
import { OPEN_TAFFETA_STORY_EVENT } from "./events";

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(6);
  }
}

export function StoryModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_TAFFETA_STORY_EVENT, handleOpen);
    return () => {
      window.removeEventListener(OPEN_TAFFETA_STORY_EVENT, handleOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="lb-lightbox fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="lb-sheet relative flex max-h-[92svh] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[28px] bg-[color:var(--lb-bg)] text-left shadow-2xl sm:max-h-[88vh] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--lb-line)] bg-[color:var(--lb-bg)]/95 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--lb-gold)]/15 text-[11px] font-bold text-[color:var(--lb-gold-ink)]">
              {taffeta.monogram}
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--lb-gold-ink)]">
                {taffetaStory.eyebrow}
              </p>
              <h2
                id="story-modal-title"
                className="text-[15px] font-bold leading-none tracking-[-0.01em] text-[color:var(--lb-ink)]"
              >
                Taffeta Coffee House
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic();
              setOpen(false);
            }}
            aria-label="Close story"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lb-surface)] text-[color:var(--lb-dim)] shadow-sm border border-[color:var(--lb-line)] transition active:scale-95 hover:bg-[color:var(--lb-press)] hover:text-[color:var(--lb-ink)]"
          >
            <X size={17} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Scrollable Editorial Body */}
        <div className="overflow-y-auto px-5 pb-8 pt-4 scroll-smooth">
          {/* Hero Photography Banner */}
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[color:var(--lb-line)] shadow-sm">
            <Image
              src={taffetaStory.heroImage}
              alt="Taffeta Coffee Glasshouse Facade"
              fill
              priority
              quality={100}
              placeholder="blur"
              sizes="(max-width: 500px) 100vw, 500px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3.5 left-4 right-4 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-medium tracking-wide backdrop-blur-md">
                <MapPin size={11} className="text-[#e2ca9c]" />
                {taffetaStory.locationBadge}
              </span>
              <h3 className="mt-1.5 text-[18px] font-bold leading-snug tracking-[-0.01em] text-white">
                {taffetaStory.title}
              </h3>
            </div>
          </div>

          {/* Section: Founders & 25-Year Hospitality Heritage */}
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lb-gold)]/20 text-[color:var(--lb-gold-ink)]">
                <Award size={14} />
              </span>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--lb-gold-ink)]">
                Founders & 25-Year Legacy
              </p>
            </div>
            <h4 className="mt-1 text-[17px] font-bold tracking-tight text-[color:var(--lb-ink)]">
              Crafted by Aziz Panwar & Shokat Panwar
            </h4>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[color:var(--lb-dim)]">
              {taffetaStory.founders.vision}
            </p>

            <div className="mt-3 rounded-2xl border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)] p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--lb-faint)]">
                25 Years of Culinary Institutions in Jaipur
              </p>
              <div className="mt-2.5 flex flex-col gap-2">
                {taffetaStory.founders.sisterBrands.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-start justify-between gap-2 rounded-xl bg-[color:var(--lb-bg)]/80 px-3 py-2"
                  >
                    <div>
                      <span className="block text-[12.5px] font-bold text-[color:var(--lb-ink)]">
                        {b.name}
                      </span>
                      <span className="text-[10.5px] text-[color:var(--lb-dim)]">
                        {b.type} · {b.note}
                      </span>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full bg-[color:var(--lb-gold)]/15 px-2 py-0.5 text-[9px] font-bold text-[color:var(--lb-gold-ink)]">
                      Panwar Hospitality
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Timeline & Milestones */}
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lb-gold)]/20 text-[color:var(--lb-gold-ink)]">
                <Clock size={14} />
              </span>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--lb-gold-ink)]">
                Milestones & Timeline
              </p>
            </div>
            <h4 className="mt-1 text-[17px] font-bold tracking-tight text-[color:var(--lb-ink)]">
              From Landmark Debut to National Acclaim
            </h4>

            <div className="relative mt-3 pl-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-[2px] before:bg-[color:var(--lb-line)]">
              {taffetaStory.milestones.map((m) => (
                <div key={m.date} className="relative mb-4 last:mb-0">
                  <span className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--lb-bg)] bg-[color:var(--lb-gold-ink)] shadow-sm" />
                  <div className="rounded-xl border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)] p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-extrabold text-[color:var(--lb-gold-ink)]">
                        {m.date}
                      </span>
                      <span className="rounded-full bg-[color:var(--lb-press)] px-2 py-0.5 text-[9.5px] font-semibold text-[color:var(--lb-dim)]">
                        {m.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] font-bold text-[color:var(--lb-ink)]">
                      {m.title}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[color:var(--lb-dim)]">
                      {m.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Craft & Modbar Innovation */}
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lb-gold)]/20 text-[color:var(--lb-gold-ink)]">
                <Coffee size={14} />
              </span>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--lb-gold-ink)]">
                The Modbar & Roastery Craft
              </p>
            </div>
            <h4 className="mt-1 text-[17px] font-bold tracking-tight text-[color:var(--lb-ink)]">
              Zero-Barrier Brewing & Global Terroirs
            </h4>

            <div className="mt-3 grid grid-cols-1 gap-2.5">
              {taffetaStory.craft.map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)] p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-[13.5px] font-bold text-[color:var(--lb-ink)]">
                      {c.title}
                    </h5>
                    <span className="rounded-full bg-[color:var(--lb-gold)]/15 px-2 py-0.5 text-[9.5px] font-bold text-[color:var(--lb-gold-ink)]">
                      {c.tag}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--lb-dim)]">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Signature Menu Items */}
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lb-gold)]/20 text-[color:var(--lb-gold-ink)]">
                <Sparkles size={14} />
              </span>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--lb-gold-ink)]">
                Signature House Specialties
              </p>
            </div>
            <h4 className="mt-1 text-[17px] font-bold tracking-tight text-[color:var(--lb-ink)]">
              Acclaimed Coffees & Scratch Bakery
            </h4>

            <div className="mt-3 flex flex-col gap-3">
              {taffetaStory.signatures.map((group) => (
                <div
                  key={group.category}
                  className="rounded-2xl border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)] p-3.5 shadow-sm"
                >
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--lb-gold-ink)]">
                    {group.category}
                  </p>
                  <div className="mt-2 flex flex-col divide-y divide-[color:var(--lb-line)]">
                    {group.items.map((item) => (
                      <div key={item.name} className="py-2.5 first:pt-1 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-[color:var(--lb-ink)]">
                            {item.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-[color:var(--lb-bg)] px-2 py-0.5 text-[9px] font-semibold text-[color:var(--lb-dim)] border border-[color:var(--lb-line)]">
                            {item.tag}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-[color:var(--lb-dim)]">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Ambiance & Work Utilities */}
          <div className="mt-6 rounded-2xl border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lb-gold)]/20 text-[color:var(--lb-gold-ink)]">
                <Building2 size={14} />
              </span>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--lb-gold-ink)]">
                Ambiance & Remote Work
              </p>
            </div>
            <h4 className="mt-1 text-[15px] font-bold text-[color:var(--lb-ink)]">
              {taffetaStory.space.title}
            </h4>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--lb-dim)]">
              {taffetaStory.space.description}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {taffetaStory.space.features.map((feat) => (
                <div
                  key={feat}
                  className="flex items-center gap-2 rounded-lg bg-[color:var(--lb-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--lb-ink)]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--lb-gold)]" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signature Signoff */}
          <div className="mt-6 rounded-2xl bg-[color:var(--lb-surface)] p-4 text-center border border-[color:var(--lb-gold)]/25">
            <p className="text-[13px] font-serif italic text-[color:var(--lb-ink)]">
              &ldquo;{taffetaStory.quote}&rdquo;
            </p>
            <p className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--lb-gold-ink)]">
              {taffetaStory.signature}
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <a
              href="/menu.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--lb-ink)] py-3 text-center text-[12px] font-bold text-white shadow-sm transition active:scale-98 hover:opacity-95"
              onPointerDown={haptic}
            >
              <span>Explore Menu</span>
              <ExternalLink size={13} />
            </a>
            <a
              href="/chat"
              className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--lb-line)] bg-[color:var(--lb-surface)] py-3 text-center text-[12px] font-bold text-[color:var(--lb-ink)] shadow-sm transition active:scale-98 hover:bg-[color:var(--lb-press)]"
              onPointerDown={haptic}
            >
              <Sparkles size={13} className="text-[color:var(--lb-gold-ink)]" />
              <span>Ask AI Concierge</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

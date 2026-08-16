"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Sparkles,
  MapPin,
  ScrollText,
  Share2,
  Check,
  Coffee,
  Wine,
  UtensilsCrossed,
  Trees,
  Flame,
} from "lucide-react";
import {
  taffeta,
  gallery as taffetaGalleryList,
  lobbyVenues,
  type LobbyVenue,
} from "@/lib/content";

type VenueItem = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  area: string;
  address: string;
  logo: typeof taffeta.logo;
  logoHeight: number;
  icon: typeof Coffee;
  iconColor: string;
  accentBadge: string;
  menuUrl?: string;
  mapsUrl?: string;
  photos: { image: typeof taffeta.logo; alt: string }[];
};

export function GalleryView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialVenue = searchParams.get("venue") || "taffeta";

  const [activeVenueId, setActiveVenueId] = useState<string>(initialVenue);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync state with URL parameter if changed
  useEffect(() => {
    const v = searchParams.get("venue");
    if (v && ["taffeta", "dupion", "lazymojo", "magnolia", "chaat"].includes(v)) {
      setActiveVenueId(v);
    }
  }, [searchParams]);

  // Build the complete 5 venue catalog
  const venues: VenueItem[] = useMemo(() => {
    const taffetaItem: VenueItem = {
      id: "taffeta",
      name: "Taffeta",
      category: "Specialty Coffee & Glasshouse",
      tagline: "Concrete, cane and slow mornings. North India's premier Modbar coffee sanctuary.",
      area: "Jawahar Circle, Jaipur",
      address: "524, Saryu Bhawan, Siddharth Nagar, Tonk Road / Jawahar Circle, Jaipur",
      logo: taffeta.logo,
      logoHeight: 88,
      icon: Coffee,
      iconColor: "#c8a76e",
      accentBadge: "Flagship",
      menuUrl: "/menu.pdf",
      mapsUrl: "https://maps.google.com/?q=Taffeta+Coffee+Jaipur",
      photos: taffetaGalleryList,
    };

    const sisterVenues: VenueItem[] = lobbyVenues.map((v) => {
      let icon = UtensilsCrossed;
      let badge = "Sister Venue";
      let iconColor = "#c8a76e";

      if (v.id === "dupion") {
        icon = Wine;
        badge = "Cocktail Room";
        iconColor = "#e0c28c";
      } else if (v.id === "lazymojo") {
        icon = UtensilsCrossed;
        badge = "All-Day Café";
        iconColor = "#d4af37";
      } else if (v.id === "magnolia") {
        icon = Trees;
        badge = "Garden Theatre";
        iconColor = "#98b068";
      } else if (v.id === "chaat") {
        icon = Flame;
        badge = "Pure Veg Street Food";
        iconColor = "#df7a4a";
      }

      return {
        id: v.id,
        name: v.name,
        category: v.cuisine,
        tagline: v.note,
        area: v.area,
        address: v.address,
        logo: v.logo,
        logoHeight: Math.min(v.logoHeight, 82),
        icon,
        iconColor,
        accentBadge: badge,
        menuUrl: v.menu || (v.menus && v.menus[0]?.href),
        mapsUrl: v.mapsUrl,
        photos: v.gallery,
      };
    });

    return [taffetaItem, ...sisterVenues];
  }, []);

  const currentVenue = useMemo(
    () => venues.find((v) => v.id === activeVenueId) || venues[0],
    [venues, activeVenueId]
  );

  const switchVenue = (id: string) => {
    setActiveVenueId(id);
    setLightboxIndex(null);
    router.replace(`/gallery?venue=${id}`, { scroll: false });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentVenue.name} Gallery — Aries Tap`,
          text: `Explore the photo gallery for ${currentVenue.name} on Aries Tap.`,
          url,
        });
      } catch {
        // Share cancelled or unavailable
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard unavailable
      }
    }
  };

  // Keyboard navigation for Lightbox
  const stepLightbox = useCallback(
    (delta: number) => {
      if (lightboxIndex === null) return;
      const total = currentVenue.photos.length;
      setLightboxIndex((lightboxIndex + delta + total) % total);
    },
    [lightboxIndex, currentVenue.photos.length]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowRight") stepLightbox(1);
      else if (e.key === "ArrowLeft") stepLightbox(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, stepLightbox]);

  return (
    <div className="lb min-h-screen bg-[color:var(--lb-bg)] text-[color:var(--lb-ink)] selection:bg-[color:var(--lb-gold-ink)]/20">
      {/* Paper grain overlay */}
      <div className="lb-grain pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* Ambient background light dome */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] bg-radial from-[color:var(--lb-gold-ink)]/10 via-transparent to-transparent blur-3xl"
        aria-hidden
      />

      {/* ————————————————————— Top Sticky Glass Header ————————————————————— */}
      <header className="sticky top-0 z-30 w-full border-b border-[color:var(--lb-line)] bg-[color:var(--lb-bg)]/85 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--lb-line)] bg-[color:var(--lb-card-bg)] px-3.5 py-1.5 text-xs font-semibold tracking-tight text-[color:var(--lb-ink)] shadow-xs transition hover:border-[color:var(--lb-gold-ink)]/40 hover:text-[color:var(--lb-gold-ink)] active:scale-95"
            aria-label="Back to Aries Tap Lobby"
          >
            <ArrowLeft size={14} className="transition group-hover:-translate-x-0.5" />
            <span>Lobby</span>
          </Link>

          <div className="flex items-center gap-2 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--lb-gold-ink)]/25 bg-[color:var(--lb-gold-ink)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--lb-gold-ink)]">
              <Sparkles size={11} />
              <span>{currentVenue.name} Gallery</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--lb-line)] bg-[color:var(--lb-card-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--lb-dim)] transition hover:text-[color:var(--lb-ink)] active:scale-95 cursor-pointer"
            aria-label="Share gallery"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Share2 size={13} />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>
        </div>

        {/* ————————————————————— Venue Selector Tabs ————————————————————— */}
        <div className="no-scrollbar overflow-x-auto border-t border-[color:var(--lb-line)]/50 px-3 py-2 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-start sm:justify-center gap-2">
            {venues.map((venue) => {
              const active = venue.id === currentVenue.id;
              const Icon = venue.icon;
              return (
                <button
                  key={venue.id}
                  type="button"
                  onClick={() => switchVenue(venue.id)}
                  className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer select-none ${
                    active
                      ? "border border-[color:var(--lb-gold-ink)]/40 bg-[color:var(--lb-gold-ink)]/15 text-[color:var(--lb-gold-ink)] shadow-xs"
                      : "border border-transparent text-[color:var(--lb-dim)] hover:border-[color:var(--lb-line)] hover:bg-[color:var(--lb-card-bg)] hover:text-[color:var(--lb-ink)]"
                  }`}
                >
                  <Icon
                    size={14}
                    style={{ color: active ? venue.iconColor : undefined }}
                    className="transition group-hover:scale-110"
                  />
                  <span>{venue.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                      active
                        ? "bg-[color:var(--lb-gold-ink)] text-black"
                        : "bg-[color:var(--lb-line)] text-[color:var(--lb-faint)]"
                    }`}
                  >
                    {venue.photos.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ————————————————————— Main Gallery Content ————————————————————— */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Venue Hero Spotlight */}
        <section className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-4 flex items-center justify-center">
            <Image
              src={currentVenue.logo}
              alt={currentVenue.name}
              height={currentVenue.logoHeight}
              width={Math.round(
                (currentVenue.logoHeight * currentVenue.logo.width) /
                  currentVenue.logo.height
              )}
              priority
              quality={100}
              sizes="240px"
              className="w-auto max-h-[90px] object-contain drop-shadow-sm transition duration-300"
              style={{ height: currentVenue.logoHeight }}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-md border border-[color:var(--lb-gold-ink)]/30 bg-[color:var(--lb-gold-ink)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--lb-gold-ink)]">
              {currentVenue.accentBadge}
            </span>
            <span className="text-xs font-medium text-[color:var(--lb-dim)]">
              {currentVenue.category}
            </span>
            <span className="text-[color:var(--lb-faint)]">·</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--lb-dim)]">
              <MapPin size={11} className="text-[color:var(--lb-gold-ink)]" />
              {currentVenue.area}
            </span>
          </div>

          <p className="mt-3 max-w-xl text-sm font-normal leading-relaxed text-[color:var(--lb-dim)] sm:text-base">
            {currentVenue.tagline}
          </p>

          {/* Quick venue action pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {currentVenue.menuUrl && (
              <a
                href={currentVenue.menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--lb-line)] bg-[color:var(--lb-card-bg)] px-3.5 py-2 text-xs font-semibold text-[color:var(--lb-ink)] transition hover:border-[color:var(--lb-gold-ink)]/50 hover:text-[color:var(--lb-gold-ink)] active:scale-95"
              >
                <ScrollText size={13} className="text-[color:var(--lb-gold-ink)]" />
                <span>View Menu</span>
              </a>
            )}
            {currentVenue.mapsUrl && (
              <a
                href={currentVenue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--lb-line)] bg-[color:var(--lb-card-bg)] px-3.5 py-2 text-xs font-semibold text-[color:var(--lb-ink)] transition hover:border-[color:var(--lb-gold-ink)]/50 hover:text-[color:var(--lb-gold-ink)] active:scale-95"
              >
                <MapPin size={13} className="text-[color:var(--lb-gold-ink)]" />
                <span>Directions</span>
              </a>
            )}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-[color:var(--lb-line)]/40 px-3 py-2 text-xs font-semibold text-[color:var(--lb-dim)]">
              <Sparkles size={12} className="text-[color:var(--lb-gold-ink)]" />
              <span>{currentVenue.photos.length} High-Res Frames</span>
            </div>
          </div>
        </section>

        {/* ————————————————————— Masonry Editorial Gallery Grid ————————————————————— */}
        <section
          aria-label={`${currentVenue.name} photography gallery`}
          className="columns-1 gap-4 sm:columns-2 lg:columns-3"
        >
          {currentVenue.photos.map((photo, index) => (
            <div
              key={`${currentVenue.id}-${index}`}
              className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-[color:var(--lb-line)] bg-[color:var(--lb-card-bg)] shadow-xs transition duration-300 hover:border-[color:var(--lb-gold-ink)]/40 hover:shadow-md cursor-pointer select-none"
              onClick={() => setLightboxIndex(index)}
            >
              <div className="relative w-full overflow-hidden bg-black/5">
                <Image
                  src={photo.image}
                  alt={photo.alt}
                  quality={95}
                  placeholder="blur"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />

                {/* Subtle dark gradient overlay for hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Hover trigger badge */}
                <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 scale-90">
                  <Maximize2 size={13} />
                </div>

                {/* Hover caption badge */}
                <div className="absolute bottom-0 left-0 right-0 p-3.5 text-left opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="mb-1 inline-block rounded-md bg-[color:var(--lb-gold-ink)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-black">
                    Frame {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-xs font-medium leading-snug text-white/95 line-clamp-2">
                    {photo.alt}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Sister Venues Quick Jumper */}
        <section className="mt-16 rounded-3xl border border-[color:var(--lb-line)] bg-[color:var(--lb-card-bg)] p-6 sm:p-8 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--lb-gold-ink)]">
            Explore More
          </span>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            More Galleries from the Collection
          </h2>
          <p className="mt-2 text-xs text-[color:var(--lb-dim)] sm:text-sm">
            Tap below to explore house photography across all 5 dining concepts in Jaipur.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {venues
              .filter((v) => v.id !== currentVenue.id)
              .map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      switchVenue(v.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--lb-line)] bg-[color:var(--lb-bg)]/80 p-3.5 text-center transition hover:border-[color:var(--lb-gold-ink)]/50 hover:bg-[color:var(--lb-card-bg)] active:scale-95 cursor-pointer"
                  >
                    <Icon size={16} style={{ color: v.iconColor }} />
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--lb-ink)]">{v.name}</h4>
                      <span className="text-[10px] font-medium text-[color:var(--lb-faint)]">
                        {v.photos.length} photos
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--lb-gold-ink)] px-6 py-2.5 text-xs font-bold text-black transition hover:opacity-90 active:scale-95"
            >
              <ArrowLeft size={14} />
              <span>Return to Aries Tap Lobby</span>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--lb-faint)]">
            Powered by Aries Tap
          </p>
        </footer>
      </main>

      {/* ————————————————————— Fullscreen Ultra-Aesthetic Lightbox ————————————————————— */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 px-4 py-4 backdrop-blur-xl animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`${currentVenue.name} photo viewer`}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="flex w-full max-w-6xl items-center justify-between px-2 pt-1 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white/90">
                {lightboxIndex + 1} / {currentVenue.photos.length}
              </span>
              <span className="hidden text-xs font-medium text-white/60 sm:inline">
                {currentVenue.name}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90 cursor-pointer"
              aria-label="Close photo viewer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Center Main Photo Frame */}
          <div
            className="relative flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={currentVenue.photos[lightboxIndex].image}
              alt={currentVenue.photos[lightboxIndex].alt}
              quality={100}
              placeholder="blur"
              priority
              sizes="100vw"
              className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-2xl transition duration-200 select-none"
            />

            {/* Left Prev Arrow */}
            {currentVenue.photos.length > 1 && (
              <button
                type="button"
                onClick={() => stepLightbox(-1)}
                className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md transition hover:bg-white/25 active:scale-90 cursor-pointer sm:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Right Next Arrow */}
            {currentVenue.photos.length > 1 && (
              <button
                type="button"
                onClick={() => stepLightbox(1)}
                className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md transition hover:bg-white/25 active:scale-90 cursor-pointer sm:right-4"
                aria-label="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Caption & Thumbnail Strip */}
          <div
            className="flex w-full max-w-3xl flex-col items-center gap-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="max-w-xl text-xs font-medium leading-relaxed text-white/85 sm:text-sm">
              {currentVenue.photos[lightboxIndex].alt}
            </p>

            {/* Micro thumbnail strip */}
            <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto py-1">
              {currentVenue.photos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border transition cursor-pointer ${
                    idx === lightboxIndex
                      ? "border-[color:var(--lb-gold-ink)] scale-105 shadow-md"
                      : "border-white/20 opacity-50 hover:opacity-100"
                  }`}
                  aria-label={`Jump to photo ${idx + 1}`}
                >
                  <Image
                    src={p.image}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

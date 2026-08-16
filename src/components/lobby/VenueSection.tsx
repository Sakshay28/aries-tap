"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ScrollText, MapPin, Images, type LucideIcon } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { Reveal } from "@/components/Reveal";
import { Lightbox } from "./Lightbox";
import { MenuSheet } from "./MenuSheet";
import type { LobbyVenue } from "@/lib/content";

// One sister venue: its brand mark and three clean cards —
// Menu, Location, Gallery. Menu and Location are links; Gallery opens the shared
// lightbox. A card with no destination reads as an intentional "Soon".

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(6);
  }
}

const cardClass =
  "lb-card group flex min-h-[86px] flex-col items-center justify-center gap-2 px-2 py-4 text-center no-underline select-none cursor-pointer";

function Face({
  Icon,
  label,
  delay,
}: {
  Icon: LucideIcon;
  label: string;
  // Phase offset (s) for the icon's breathing cycle — organic, not synchronised.
  delay?: number;
}) {
  return (
    <>
      <span
        className="lb-ico-wrap"
        style={delay ? { animationDelay: `${delay}s` } : undefined}
      >
        <Icon
          size={20}
          strokeWidth={1.5}
          className="lb-ico text-[color:var(--lb-gold-ink)]"
          aria-hidden
        />
      </span>
      <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-[color:var(--lb-ink)]">
        {label}
      </span>
    </>
  );
}

function Soon({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <div className="lb-soon flex min-h-[86px] flex-col items-center justify-center gap-1 px-2 py-4 text-center">
      <Icon
        size={20}
        strokeWidth={1.5}
        className="text-[color:var(--lb-faint)]"
        aria-hidden
      />
      <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-[color:var(--lb-faint)]">
        {label}
      </span>
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--lb-faint)]">
        Soon
      </span>
    </div>
  );
}

export function VenueSection({ venue }: { venue: LobbyVenue }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [menusOpen, setMenusOpen] = useState(false);

  // A venue shows either one wide frame or a portrait triptych. Those sit ahead
  // of any gallery-only photos in the venue's single Lightbox, and the Gallery
  // card opens that whole set from the top — so it stays useful whether the
  // extra photos exist (LazyMojo) or the strip is all there is (Magnolia).
  const shots = venue.photo ? [venue.photo] : (venue.strip ?? []);
  const viewerPhotos = [
    ...shots.map((s) => ({ image: s.image, alt: s.alt })),
    ...venue.gallery,
  ];
  const canView = viewerPhotos.length > 0;

  return (
    <section id={venue.id} aria-labelledby={`${venue.id}-name`}>
      <Reveal variant="rise" className="flex flex-col items-center text-center">
        <h2 id={`${venue.id}-name`} className="flex items-center justify-center">
          <Image
            src={venue.logo}
            alt={venue.name}
            height={venue.logoHeight}
            width={Math.round(
              (venue.logoHeight * venue.logo.width) / venue.logo.height
            )}
            quality={100}
            sizes="280px"
            className="w-auto object-contain"
            style={{ height: venue.logoHeight }}
          />
        </h2>
        {venue.instagramHandle && venue.instagramUrl && (
          <a
            href={venue.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${venue.name} on Instagram (${venue.instagramHandle})`}
            className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium tracking-tight text-[color:var(--lb-dim)] transition-colors hover:text-[color:var(--lb-ink)]"
          >
            <InstagramIcon size={12.5} className="text-[color:var(--lb-gold-ink)]" />
            <span>{venue.instagramHandle}</span>
          </a>
        )}
        {venue.openingSoon && (
          <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[color:var(--lb-gold-ink)]">
            Opening soon
          </p>
        )}
      </Reveal>

      <Reveal variant="stagger" className="mt-3.5 grid grid-cols-3 gap-2.5">
        {venue.mapsUrl ? (
          <a
            href={venue.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cardClass}
            aria-label={`${venue.name} — open in Google Maps`}
            onPointerDown={haptic}
          >
            <Face Icon={MapPin} label="Location" delay={0.9} />
          </a>
        ) : (
          <Soon Icon={MapPin} label="Location" />
        )}

        {canView ? (
          <Link
            href={`/gallery?venue=${venue.id}`}
            className={cardClass}
            aria-label={`${venue.name} — open gallery`}
            onPointerDown={haptic}
          >
            <Face Icon={Images} label="Gallery" delay={2.6} />
          </Link>
        ) : (
          <Soon Icon={Images} label="Gallery" />
        )}

        {venue.menus?.length ? (
          <button
            type="button"
            className={cardClass}
            aria-label={`${venue.name} — choose a menu`}
            onPointerDown={haptic}
            onClick={() => setMenusOpen(true)}
          >
            <Face Icon={ScrollText} label="Menu" delay={4.8} />
          </button>
        ) : venue.menu ? (
          <a
            href={venue.menu}
            target="_blank"
            rel="noopener noreferrer"
            className={cardClass}
            aria-label={`${venue.name} — menu`}
            onPointerDown={haptic}
          >
            <Face Icon={ScrollText} label="Menu" delay={4.8} />
          </a>
        ) : (
          <Soon Icon={ScrollText} label="Menu" />
        )}
      </Reveal>

      {shots.length > 0 && (
        <Reveal
          variant="scale"
          className={
            venue.photo ? "mt-2.5" : "mt-2.5 grid grid-cols-3 gap-2"
          }
        >
          {shots.map((shot, i) => (
            <button
              key={shot.alt}
              type="button"
              className={`lb-shot${venue.photo ? " lb-shot-wide" : ""}`}
              aria-label={`${shot.alt} — view photo`}
              onClick={() => setLightbox(i)}
            >
              <Image
                src={shot.image}
                alt={shot.alt}
                fill
                quality={100}
                placeholder="blur"
                sizes={
                  venue.photo
                    ? "(max-width: 500px) 92vw, 460px"
                    : "(max-width: 500px) 32vw, 160px"
                }
                className="lb-shot-img object-cover"
                style={{ objectPosition: shot.focus }}
              />
            </button>
          ))}
        </Reveal>
      )}

      <Lightbox
        photos={viewerPhotos}
        index={lightbox}
        label={`${venue.name} gallery`}
        onClose={() => setLightbox(null)}
        onIndex={setLightbox}
      />

      {venue.menus?.length ? (
        <MenuSheet
          venueName={venue.name}
          menus={venue.menus}
          open={menusOpen}
          onClose={() => setMenusOpen(false)}
        />
      ) : null}
    </section>
  );
}

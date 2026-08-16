"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { taffeta, taffetaGallery, gallery } from "@/lib/content";
import { OPEN_TAFFETA_GALLERY_EVENT } from "./events";

// The house photography. A cinematic wide banner of the flagship or a portrait
// triptych. Tapping one or tapping the Gallery action card opens it whole in the viewer.

export function PhotoStrip() {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    function handleOpen(e: Event) {
      const customEvent = e as CustomEvent<{ index?: number }>;
      setOpen(customEvent.detail?.index ?? 0);
    }
    window.addEventListener(OPEN_TAFFETA_GALLERY_EVENT, handleOpen);
    return () => {
      window.removeEventListener(OPEN_TAFFETA_GALLERY_EVENT, handleOpen);
    };
  }, []);

  const viewerPhotos = [
    ...(taffeta.photo ? [{ image: taffeta.photo.image, alt: taffeta.photo.alt }] : []),
    ...taffetaGallery,
    ...gallery,
  ];

  return (
    <>
      {taffeta.photo ? (
        <div className="lb-in-photo mt-2.5">
          <button
            type="button"
            className="lb-shot lb-shot-wide cursor-pointer"
            aria-label={`${taffeta.photo.alt} — view photo`}
            onClick={() => setOpen(0)}
          >
            <Image
              src={taffeta.photo.image}
              alt={taffeta.photo.alt}
              fill
              quality={100}
              placeholder="blur"
              sizes="(max-width: 500px) 92vw, 460px"
              className="lb-shot-img object-cover"
              style={{ objectPosition: taffeta.photo.focus }}
            />
          </button>
        </div>
      ) : (
        <div className="lb-in-photo mt-2.5 grid grid-cols-3 gap-2">
          {taffetaGallery.map((photo, i) => (
            <button
              key={photo.alt}
              type="button"
              className="lb-shot cursor-pointer"
              aria-label={`${photo.alt} — view photo`}
              onClick={() => setOpen(i)}
            >
              <Image
                src={photo.image}
                alt={photo.alt}
                fill
                quality={100}
                placeholder="blur"
                sizes="(max-width: 500px) 32vw, 160px"
                className="lb-shot-img object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex justify-center">
        <Link
          href="/gallery?venue=taffeta"
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--lb-gold-ink)]/25 bg-[color:var(--lb-gold-ink)]/10 px-3.5 py-1 text-[11px] font-semibold text-[color:var(--lb-gold-ink)] transition hover:border-[color:var(--lb-gold-ink)]/50 active:scale-95"
        >
          <Sparkles size={11} />
          <span>View all 20 gallery photographs →</span>
        </Link>
      </div>

      <Lightbox
        photos={viewerPhotos}
        index={open}
        label="Taffeta photographs"
        onClose={() => setOpen(null)}
        onIndex={setOpen}
      />
    </>
  );
}

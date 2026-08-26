"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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

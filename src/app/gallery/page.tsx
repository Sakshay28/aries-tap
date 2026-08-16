import { Suspense } from "react";
import type { Metadata } from "next";
import { GalleryView } from "./GalleryView";

export const metadata: Metadata = {
  title: "House Photography & Gallery — Aries Tap",
  description:
    "Explore the curated photo collections of Taffeta, Dupion Cocktail Room, Cafe LazyMojo, The Magnolia, and Chaat 'n' Chutneys.",
};

export default function GalleryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0e0d0b] text-[#c8a76e]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a76e] border-t-transparent" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Loading Gallery...</p>
          </div>
        </div>
      }
    >
      <GalleryView />
    </Suspense>
  );
}

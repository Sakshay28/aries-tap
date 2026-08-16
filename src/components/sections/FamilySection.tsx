import Image from "next/image";
import { Star, ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { family } from "@/lib/content";

// Sister venues from the same owner. Full-bleed cards, one per row: the
// photograph carries the mood, a scrim keeps the type legible, and the whole
// card opens the venue in Google Maps. Data-driven — an empty list hides it.

export function FamilySection() {
  if (family.venues.length === 0) return null;
  return (
    <section id="family" className="scroll-mt-6 px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          {family.eyebrow}
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          {family.title}
        </h2>
      </Reveal>

      <div className="mt-10 flex flex-col gap-6">
        {family.venues.map((venue) => (
          <Reveal key={venue.name} variant="scale">
            <a
              href={venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${venue.name} — open in Google Maps`}
              className="lift group relative block overflow-hidden rounded-[20px] border border-line"
            >
              <div className="relative aspect-[4/5]">
                <Image
                  src={venue.image}
                  alt={venue.name}
                  placeholder="blur"
                  quality={100}
                  sizes="(max-width: 448px) 100vw, 416px"
                  className="h-full w-full object-cover"
                />
                {/* Scrim: dark from the bottom so the type below always reads,
                    with a touch at the top for the rating chip. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />

                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
                  <Star size={12} strokeWidth={2.25} className="fill-[#e0c28c] text-[#e0c28c]" aria-hidden />
                  <span className="text-[12px] font-semibold text-white tabular-nums">
                    {venue.rating}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e0c28c]">
                    {venue.area}
                  </p>
                  <h3 className="mt-1.5 flex items-center gap-1.5 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-white">
                    {venue.name}
                    <ArrowUpRight
                      size={20}
                      strokeWidth={1.75}
                      className="translate-x-[-4px] text-white/70 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                      aria-hidden
                    />
                  </h3>
                  <p className="mt-2 max-w-[92%] text-[14px] leading-relaxed text-white/85">
                    {venue.tagline}
                  </p>
                  <p className="mt-3 text-[12px] font-medium text-white/65">
                    {venue.cuisine}
                  </p>
                </div>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

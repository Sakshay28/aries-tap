import { Phone, Navigation, CalendarCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { business, location } from "@/lib/content";

// Section 9 — location. The map wears the room's palette (see .map-frame),
// hours read like a menu, and the three actions share one glass bar.

export function LocationSection() {
  return (
    <section className="px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Find us
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          {location.address}
        </h2>
      </Reveal>

      <Reveal variant="scale" className="mt-8">
        <div className="overflow-hidden rounded-[20px] border border-line">
          <iframe
            src={location.mapEmbed}
            title={`Map — ${business.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="map-frame h-64 w-full border-0"
          />
        </div>
      </Reveal>

      <Reveal variant="stagger" className="mt-8">
        {location.hours.map((row) => (
          <div
            key={row.days}
            className="flex items-baseline justify-between border-b border-line py-3.5 last:border-0"
          >
            <p className="text-[14px] font-medium text-ink-dim">{row.days}</p>
            <p className="text-[14px] font-semibold tabular-nums">{row.time}</p>
          </div>
        ))}
      </Reveal>

      <Reveal variant="rise" className="mt-8">
        <div className="glass flex overflow-hidden rounded-2xl">
          <a
            href={`tel:${location.phone}`}
            className="row flex flex-1 flex-col items-center gap-1.5 py-4"
          >
            <Phone size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
            <span className="text-[12px] font-semibold">Call</span>
          </a>
          <div className="w-px bg-line" aria-hidden />
          <a
            href={location.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="row flex flex-1 flex-col items-center gap-1.5 py-4"
          >
            <Navigation size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
            <span className="text-[12px] font-semibold">Directions</span>
          </a>
          <div className="w-px bg-line" aria-hidden />
          <a
            href={location.bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="row flex flex-1 flex-col items-center gap-1.5 py-4"
          >
            <CalendarCheck size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
            <span className="text-[12px] font-semibold">Book Table</span>
          </a>
        </div>
      </Reveal>
    </section>
  );
}

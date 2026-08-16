import { Reveal } from "@/components/Reveal";
import { events } from "@/lib/content";

// Section 6 — events. Fully data-driven: an empty list removes the section.
// Rows, not cards: a date worth reading and a hairline between evenings.

export function EventsSection() {
  if (events.length === 0) return null;
  return (
    <section className="px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Upcoming
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          Evenings at the house.
        </h2>
      </Reveal>

      <Reveal variant="stagger" className="mt-8">
        {events.map((event, i) => (
          <div key={event.title}>
            {i > 0 && <div className="h-px bg-line" aria-hidden />}
            <div className="flex items-center gap-5 py-5">
              <div className="w-12 shrink-0 text-center">
                <p className="text-[22px] font-semibold leading-none tracking-[-0.02em]">
                  {event.day}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-dim">
                  {event.month}
                </p>
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                  {event.title}
                </h3>
                <p className="mt-0.5 truncate text-[13px] text-ink-dim">
                  {event.description}
                </p>
              </div>
              <p className="ml-auto shrink-0 text-[13px] font-medium text-accent">
                {event.time}
              </p>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

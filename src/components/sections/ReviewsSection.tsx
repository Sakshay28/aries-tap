import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { reviews } from "@/lib/content";

// Section 8 — reviews. The number is the hero; two voices beneath it in
// large, quiet type. No cards, no avatars, no star icons.

export function ReviewsSection() {
  return (
    <section className="px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Guests
        </p>
        <p className="mt-3 text-[72px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
          <CountUp to={reviews.rating} decimals={1} />
        </p>
        <p className="mt-2 text-[13px] font-medium text-ink-dim">
          from <CountUp to={reviews.count} className="tabular-nums" /> reviews
        </p>
      </Reveal>

      <div className="mt-12 flex flex-col gap-10">
        {reviews.quotes.map((quote) => (
          <Reveal key={quote.name} variant="rise">
            <blockquote className="text-[19px] font-medium leading-snug tracking-[-0.01em]">
              “{quote.text}”
            </blockquote>
            <p className="mt-3 text-[13px] text-ink-dim">{quote.name}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

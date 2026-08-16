import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { specials } from "@/lib/content";

// Section 5 — today's specials. A snap-scrolling rail of quiet cards; on
// pointer devices each card lifts slowly, like it's being picked up.

export function Specials() {
  if (specials.length === 0) return null;
  return (
    <section id="specials" className="scroll-mt-6 pt-28">
      <Reveal variant="stagger" className="px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Today
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          Specials on the pass.
        </h2>
      </Reveal>

      <Reveal variant="rise">
        <div className="rail mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2">
          {specials.map((special) => (
            <article
              key={special.name}
              className="lift w-[240px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-line"
            >
              <Image
                src={special.image}
                alt={special.name}
                placeholder="blur"
                quality={100}
                sizes="240px"
                className="aspect-[5/4] w-full object-cover"
              />
              <div className="flex items-baseline justify-between gap-3 px-4 py-4">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
                    {special.name}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-ink-dim">{special.tag}</p>
                </div>
                <p className="price text-[14px] font-semibold text-accent">
                  {special.price}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

import Image from "next/image";
import { clsx } from "clsx";
import { Reveal } from "@/components/Reveal";
import { signatures } from "@/lib/content";

// Section 2 — signature dishes. Editorial, not a card grid: each dish is an
// image unveiled like a curtain, alternating sides, with its text set on the
// opposite edge and a hairline of accent for the price.

export function Signatures() {
  if (signatures.length === 0) return null;
  return (
    <section id="signatures" className="scroll-mt-6 px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Signatures
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          What the house is known for.
        </h2>
      </Reveal>

      <div className="mt-12 flex flex-col gap-16">
        {signatures.map((dish, i) => {
          const right = i % 2 === 1;
          return (
            <article key={dish.name}>
              <Reveal
                variant={right ? "mask-r" : "mask"}
                className={clsx("w-4/5", right && "ml-auto")}
              >
                <Image
                  src={dish.image}
                  alt={dish.name}
                  placeholder="blur"
                  quality={100}
                  sizes="(max-width: 448px) 80vw, 360px"
                  className="aspect-square w-full rounded-[20px] object-cover"
                />
              </Reveal>
              <Reveal
                variant="stagger"
                className={clsx("mt-5 w-4/5", !right && "ml-auto text-right")}
              >
                <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
                  {dish.name}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-dim">
                  {dish.note}
                </p>
                <p className="mt-2 text-[14px] font-semibold text-accent">
                  {dish.price}
                </p>
              </Reveal>
            </article>
          );
        })}
      </div>
    </section>
  );
}

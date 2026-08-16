import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { story } from "@/lib/content";

// Section 3 — the room. A wide breath of the space with soft parallax,
// a few lines of type, and one close detail shot offset from the column.

export function Story() {
  return (
    <section className="pt-28">
      <Reveal variant="scale" className="px-5">
        <div className="overflow-hidden rounded-[20px]">
          <Image
            src={story.imageWide}
            alt="Inside the space"
            placeholder="blur"
            quality={100}
            sizes="(max-width: 448px) 100vw, 448px"
            className="plx aspect-[16/9] w-full object-cover"
          />
        </div>
      </Reveal>

      <Reveal variant="stagger" className="px-5 pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          {story.eyebrow}
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          {story.title}
        </h2>
        {story.lines.map((line) => (
          <p key={line} className="mt-4 text-[15px] leading-relaxed text-ink-dim">
            {line}
          </p>
        ))}
      </Reveal>

      <Reveal variant="mask-r" className="ml-auto mt-10 w-3/5 pr-5">
        <Image
          src={story.imageDetail}
          alt="The slow bar"
          placeholder="blur"
          quality={100}
          sizes="(max-width: 448px) 60vw, 260px"
          className="aspect-square w-full rounded-l-[20px] rounded-r-none object-cover"
        />
      </Reveal>
    </section>
  );
}

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { clsx } from "clsx";
import { Reveal } from "@/components/Reveal";
import { instagram } from "@/lib/content";

// Section 7 — Instagram. No embeds, no widgets: our own masonry of the feed,
// every tile opening the profile externally.

const aspects = ["aspect-square", "aspect-[4/5]", "aspect-[3/4]"];

export function InstagramSection() {
  if (instagram.posts.length === 0) return null;
  return (
    <section className="px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Instagram
        </p>
        <a
          href={instagram.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-baseline gap-1.5"
        >
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            {instagram.handle}
          </h2>
          <ArrowUpRight size={20} strokeWidth={1.75} className="self-center text-ink-dim" aria-hidden />
        </a>
      </Reveal>

      <div className="mt-10 columns-2 gap-3">
        {instagram.posts.map((post, i) => (
          <Reveal
            key={post.alt}
            variant="scale"
            className={clsx(
              "mb-3 break-inside-avoid",
              i % 3 === 1 && "rv-d1",
              i % 3 === 2 && "rv-d2"
            )}
          >
            <a
              href={instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${post.alt} — open Instagram`}
              className="block overflow-hidden rounded-2xl"
            >
              <Image
                src={post.image}
                alt={post.alt}
                placeholder="blur"
                quality={100}
                sizes="(max-width: 448px) 50vw, 220px"
                className={clsx(
                  "w-full object-cover",
                  aspects[(i + 1) % aspects.length]
                )}
              />
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

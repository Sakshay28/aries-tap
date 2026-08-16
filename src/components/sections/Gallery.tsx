import Image from "next/image";
import { clsx } from "clsx";
import { Reveal } from "@/components/Reveal";
import { gallery } from "@/lib/content";

// Section 4 — gallery. Two-lane masonry via CSS columns; every image settles
// into place with a scale reveal. Variable heights come from alternating
// aspect ratios, not random crops, so the rhythm stays deliberate.

const aspects = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]"];

export function Gallery() {
  if (gallery.length === 0) return null;
  return (
    <section className="px-5 pt-28">
      <Reveal variant="stagger">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Gallery
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          Around the room.
        </h2>
      </Reveal>

      <div className="mt-10 columns-2 gap-3">
        {gallery.map((item, i) => (
          <Reveal
            key={item.alt}
            variant="scale"
            className={clsx(
              "mb-3 break-inside-avoid",
              i % 3 === 1 && "rv-d1",
              i % 3 === 2 && "rv-d2"
            )}
          >
            <Image
              src={item.image}
              alt={item.alt}
              placeholder="blur"
              quality={100}
              sizes="(max-width: 448px) 50vw, 220px"
              className={clsx(
                "w-full rounded-2xl object-cover",
                aspects[i % aspects.length]
              )}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

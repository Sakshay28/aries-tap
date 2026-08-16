import Image from "next/image";
import { ParallaxLayer } from "@/components/ParallaxLayer";
import { business, heroImage } from "@/lib/content";

// The cinematic backdrop behind the first screen. Layer order, bottom up:
// photograph (Ken Burns drift + focus-pull, inside the parallax depth
// layer) → light sweep → readability veil → lens bloom → vignette →
// particles → film grain. Everything except the parallax driver is pure
// CSS on the compositor.

export function Atmosphere() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <ParallaxLayer>
        <div className="atm-focus absolute inset-0">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            placeholder="blur"
            quality={100}
            sizes="100vw"
            className="atm-media object-cover"
          />
        </div>
        {/* Cinematic grade: gold into the highlights, warmth into the
            blacks. These blend with the photo, so they ride inside the
            parallax layer. */}
        <div className="atm-lift absolute inset-0" />
        <div className="atm-tint absolute inset-0" />
      </ParallaxLayer>
      {/* Sunlight passing through the room every ~17s. */}
      <div className="atm-sweep absolute inset-0" />
      {/* Readability veil — resolves into the page background at the bottom
          so the hero melts into the sections below with no seam. */}
      <div className="atm-grad absolute inset-0" />
      {/* Stage-one darkness; burns off as the room comes into focus. */}
      <div className="atm-dark absolute inset-0" />
      {/* Lens bloom where the light naturally falls in the photograph. */}
      <div className="atm-bloom absolute -right-24 -top-24 h-96 w-96" />
      <div className="atm-vignette absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        <span className="prt" />
        <span className="prt" />
        <span className="prt" />
        <span className="prt" />
        <span className="prt" />
        <span className="prt" />
      </div>
      <div className="atm-grain absolute inset-0" />
      <span className="sr-only">{business.name} — the room at golden hour</span>
    </div>
  );
}

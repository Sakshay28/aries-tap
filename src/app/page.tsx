import Image from "next/image";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { ActionCard } from "@/components/lobby/ActionCard";
import { VenueSection } from "@/components/lobby/VenueSection";
import { PhotoStrip } from "@/components/lobby/PhotoStrip";
import { StoryModal } from "@/components/lobby/StoryModal";
import { ScrollProgress } from "@/components/lobby/ScrollProgress";
import { ReviewExperience } from "@/components/review/ReviewExperience";
import { taffeta, taffetaActions, lobbyVenues } from "@/lib/content";
import { reviewSettings } from "@/lib/review/config";

// The Aries Tap lobby — a centred, editorial microsite opened when a guest taps
// the table tag. The layout is deliberately still; the life is in the motion:
// a staged entrance (wordmark → tagline → cards → photograph), a photo that
// breathes, icons that breathe out of phase, gold light on the dividers, and a
// thread of scroll progress. All of it is CSS in globals.css under `.lb`.

// Irregular phase offsets so the five icons never breathe in unison.
const breatheDelays = [0, 1.4, 2.9, 4.3, 5.7];

export default function Home() {
  return (
    <main className="lb min-h-svh">
      <ScrollProgress />
      {/* Paper texture over the whole page — 2%, felt not seen. */}
      <div className="lb-grain" aria-hidden />

      <div className="mx-auto w-full max-w-[500px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(0.875rem,env(safe-area-inset-top))] text-center">
        {/* ——————————————————————— Taffeta (flagship) */}
        <section aria-labelledby="taffeta-name" className="relative">
          {/* Ambient gold light strolling behind the wordmark. */}
          <div className="lb-amb" aria-hidden />

          {/* The header exits the viewport a touch slower than the page. */}
          <div className="lb-plx-head relative">
            <h1 id="taffeta-name" className="lb-in-title flex justify-center">
              <Image
                src={taffeta.logo}
                alt="Taffeta Coffee"
                height={taffeta.logoHeight}
                width={Math.round(
                  (taffeta.logoHeight * taffeta.logo.width) / taffeta.logo.height
                )}
                priority
                quality={100}
                sizes="160px"
                className="w-auto"
                style={{ height: taffeta.logoHeight }}
              />
            </h1>
            {taffeta.instagramHandle && taffeta.instagramUrl && (
              <div className="lb-in-sub mt-2 flex justify-center">
                <a
                  href={taffeta.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${taffeta.name} on Instagram (${taffeta.instagramHandle})`}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-medium tracking-tight text-[color:var(--lb-dim)] transition-colors hover:text-[color:var(--lb-ink)]"
                >
                  <InstagramIcon size={12.5} className="text-[color:var(--lb-gold-ink)]" />
                  <span>{taffeta.instagramHandle}</span>
                </a>
              </div>
            )}
          </div>

          <div className="lb-in-cards mt-4.5 grid grid-cols-3 gap-2.5">
            {taffetaActions.map((action, i) => (
              <ActionCard
                key={action.key}
                action={action}
                breatheDelay={breatheDelays[i]}
              />
            ))}
          </div>

          {/* The house triptych — three portrait frames, tap to view whole. */}
          <PhotoStrip />
        </section>

        {/* ——————————————————————— Sister venues, each behind a gold seam. */}
        {lobbyVenues.map((venue) => (
          <div key={venue.id} className="mt-4">
            <div className="lb-divider" aria-hidden />
            <div className="mt-4">
              <VenueSection venue={venue} />
            </div>
          </div>
        ))}

        <footer className="mt-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--lb-faint)]">
            Powered by Aries Tap
          </p>
        </footer>
      </div>

      {/* The Review Experience island — inert until the review card is tapped. */}
      <ReviewExperience settings={reviewSettings()} />

      {/* The Taffeta Story editorial experience — opens on story card tap */}
      <StoryModal />
    </main>
  );
}

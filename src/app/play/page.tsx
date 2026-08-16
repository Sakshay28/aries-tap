import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { business } from "@/lib/content";
import { publicSettings } from "@/lib/playwin/config";
import { PlayExperience } from "@/components/play/PlayExperience";

export const metadata: Metadata = {
  title: `Play & Win · ${business.name}`,
  robots: { index: false }, // a table-side experience, not a landing page
};

export default function PlayPage() {
  const settings = publicSettings();

  // Nothing enabled (or no game has an engine) → a calm, on-brand empty state
  // rather than a broken screen.
  if (!settings.enabled) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center">
          <Link
            href="/"
            aria-label="Back"
            className="row -ml-2 flex h-10 w-10 items-center justify-center rounded-full"
          >
            <ArrowLeft size={20} strokeWidth={1.75} className="text-ink-dim" aria-hidden />
          </Link>
        </header>
        <div className="flex flex-1 flex-col justify-center">
          <div className="glass card-in relative overflow-hidden rounded-3xl p-8 text-center">
            <div className="bord" aria-hidden />
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Play &amp; Win</h1>
            <p className="mt-2 text-[14px] text-ink-dim">
              Our table games are taking a short break. Check back soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <PlayExperience settings={settings} />;
}

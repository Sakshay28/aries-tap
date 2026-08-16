import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { business } from "@/lib/content";
import { WifiFlow } from "./WifiFlow";

export const metadata: Metadata = {
  title: `WiFi · ${business.name}`,
  robots: { index: false }, // a utility flow, not a landing page
};

export default function WifiPage() {
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
        {/* Ambient glow behind the card, matching the home screen. */}
        <div className="amb absolute left-[-20%] top-[24%] h-[50%] w-[140%]" aria-hidden />
        <div className="glass card-in relative overflow-hidden rounded-3xl p-7">
          <div className="bord" aria-hidden />
          <WifiFlow />
        </div>
        <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint">
          {business.name} · Aries Tap
        </p>
      </div>
    </div>
  );
}

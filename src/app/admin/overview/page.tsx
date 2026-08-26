import type { Metadata } from "next";
import { business } from "@/lib/content";
import { OverviewClient } from "./OverviewClient";

export const metadata: Metadata = {
  title: `Live Dashboard · ${business.name}`,
  robots: { index: false, follow: false },
};

// The dashboard owns its full-bleed, mobile-first layout (background, centered
// shell, bottom nav) via `.od-root` in globals.css — so the page renders it
// directly rather than wrapping it in the narrow admin container the other
// admin pages use.
export default function OverviewPage() {
  return <OverviewClient />;
}

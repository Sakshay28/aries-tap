import type { Metadata, Viewport } from "next";
import { OwnerClient } from "./OwnerClient";

export const metadata: Metadata = {
  title: "Owner · Aries Tap",
  robots: { index: false, follow: false },
};

// The dashboard is light-only, so the mobile browser bar is light here too —
// overriding the venue's dark brand theme-color from the root layout.
export const viewport: Viewport = {
  themeColor: "#f4f1ea",
  colorScheme: "light",
};

// The multi-venue owner dashboard: every venue's four boxes, stacked, behind its
// own owner login (separate from each venue's admin). Full-bleed, mobile-first —
// it owns its layout via `.od-root`.
export default function OwnerPage() {
  return <OwnerClient />;
}

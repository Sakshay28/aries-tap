import type { Metadata } from "next";
import { OwnerClient } from "./OwnerClient";

export const metadata: Metadata = {
  title: "Owner · Aries Tap",
  robots: { index: false, follow: false },
};

// The multi-venue owner dashboard: every venue's four boxes, stacked, behind its
// own owner login (separate from each venue's admin). Full-bleed, mobile-first —
// it owns its layout via `.od-root`, like the single-venue dashboard.
export default function OwnerPage() {
  return <OwnerClient />;
}

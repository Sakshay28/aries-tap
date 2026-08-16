import type { MetadataRoute } from "next";
import { business } from "@/lib/content";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${business.name} — Aries Tap`,
    short_name: business.name,
    description: `Tap in to ${business.name}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0a",
    theme_color: "#0b0b0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

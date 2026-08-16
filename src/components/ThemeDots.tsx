"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { business, type ThemeName } from "@/lib/content";

// Onboarding preview control: lets a restaurant owner feel all three themes
// on the spot. The choice lives in content.ts once made; this only swaps the
// data-theme attribute, so the content never re-renders.

const themes: { name: ThemeName; label: string; swatch: string }[] = [
  { name: "noir", label: "Noir theme", swatch: "#0b0b0a" },
  { name: "linen", label: "Linen theme", swatch: "#f5f0e7" },
  { name: "forest", label: "Forest theme", swatch: "#101c15" },
];

export function ThemeDots() {
  const [active, setActive] = useState<ThemeName>(business.theme);
  const mounted = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = active;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themes.find((t) => t.name === active)!.swatch);

    // Everything morphs for 800ms instead of snapping — but only on real
    // switches, never on the initial mount.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    root.classList.add("theming");
    const timer = setTimeout(() => root.classList.remove("theming"), 850);
    return () => {
      clearTimeout(timer);
      root.classList.remove("theming");
    };
  }, [active]);

  return (
    <div className="flex items-center gap-3" role="radiogroup" aria-label="Theme">
      {themes.map((t) => (
        <button
          key={t.name}
          type="button"
          role="radio"
          aria-checked={active === t.name}
          aria-label={t.label}
          onClick={() => setActive(t.name)}
          className={clsx(
            "h-3.5 w-3.5 rounded-full border transition-transform duration-200",
            active === t.name
              ? "scale-110 border-accent"
              : "border-ink-faint opacity-70"
          )}
        >
          <span
            className="block h-full w-full rounded-full border border-line"
            data-swatch={t.name}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

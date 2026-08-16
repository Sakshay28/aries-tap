"use client";

// Map the string icon keys a venue writes in content.ts to real lucide icons.
// Explicit imports (not `import * as`) so only the icons we actually use land in
// the bundle — the app guards a tight JS budget. Unknown keys fall back to Gift.

import {
  BadgePercent,
  Clover,
  Coffee,
  Dices,
  Disc3,
  Gift,
  GlassWater,
  IceCreamCone,
  Layers,
  LayoutGrid,
  Package,
  Sparkles,
  Star,
  Target,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  BadgePercent,
  Clover,
  Coffee,
  Dices,
  Disc3,
  Gift,
  GlassWater,
  IceCreamCone,
  Layers,
  LayoutGrid,
  Package,
  Sparkles,
  Star,
  Target,
  Utensils,
};

export function iconFor(name: string | undefined): LucideIcon {
  return (name && MAP[name]) || Gift;
}

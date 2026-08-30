// The owner dashboard's own login — separate from any single venue's admin.
// A venue's admin password unlocks that one venue; the owner password unlocks
// the cross-venue view. Same signed-cookie primitives as everywhere else.

import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/wifi/session";

export const OWNER_COOKIE = "aries_owner";
export const OWNER_TTL_SECONDS = 12 * 60 * 60; // a working day

// Dev default so the multi-venue dashboard is reachable with nothing configured;
// production must set OWNER_PASSWORD (the login route fails closed without it).
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD || "owner";

export async function isOwner(req: NextRequest): Promise<boolean> {
  const payload = await verifyToken<{ kind?: string }>(req.cookies.get(OWNER_COOKIE)?.value);
  return payload?.kind === "owner";
}

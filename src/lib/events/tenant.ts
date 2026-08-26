// Tenant identity + owner-session authorization for the event subsystem.
//
// This is the ONE place the running deployment's tenant is named, and the ONE
// place an owner's dashboard request is resolved to the tenant it is allowed to
// read. It imports venue content and the signed-cookie primitives, so it is
// server-only — the pure event core (config/db/analytics/attribution/bus) never
// imports it, which is what keeps that core runnable under the test runner.
//
// The data model has always been multi-tenant-shaped (every row carries a
// tenant_id, every query is tenant-scoped). What changes here is that the tenant
// stops being a build-time constant baked into the data layer and becomes a
// value resolved authoritatively per request: from the tag's owner on writes
// (see attribution.ts / ingest.ts) and from the signed owner session on reads
// (resolveOwnerTenant, below). A client can never supply it.

import type { NextRequest } from "next/server";
import { business } from "@/lib/content";
import { verifyToken } from "@/lib/wifi/session";
import { ADMIN_COOKIE } from "@/lib/wifi/config";

// One password, every dashboard — the same signed admin cookie the WiFi,
// Reviews and Play & Win dashboards already use.
export { ADMIN_COOKIE };

// The tenant this deployment serves. Guest-facing surfaces (the landing page,
// the WhatsApp redirect, the public beacon) all belong to this one venue, so a
// page-level event with no tag attributes here. Overridable by env for a
// multi-tenant host that runs the same image for several venues.
export const DEPLOYMENT_TENANT_ID = process.env.ARIES_TENANT_ID || business.id;

// The shape the admin session carries. `tenantId` is written at login so the
// dashboard's reads and its realtime subscription are both scoped to exactly the
// business this owner may see — never a URL/query parameter, never the client.
type AdminSession = { kind?: string; tenantId?: string };

const TENANT_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

// Resolve the authenticated owner's tenant from the signed admin cookie, or null
// if the caller is not a valid admin. This is the server-side authorization gate
// for every dashboard read and the SSE subscription (spec §25): access follows
// the cookie's tenant, so an owner can never reach another tenant's data by
// editing a request. Sessions minted before tenant was recorded fall back to the
// deployment tenant, which — in a single-venue deployment — is the same value.
export async function resolveOwnerTenant(req: NextRequest): Promise<string | null> {
  const payload = await verifyToken<AdminSession>(req.cookies.get(ADMIN_COOKIE)?.value);
  if (payload?.kind !== "admin") return null;
  const claimed = typeof payload.tenantId === "string" ? payload.tenantId : "";
  return claimed && TENANT_RE.test(claimed) ? claimed : DEPLOYMENT_TENANT_ID;
}

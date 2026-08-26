// Aries Tap dynamic QR — operational constants.
//
// The whole point of this feature: the URL printed on a physical product is
// permanent, and only the *destination* behind it ever changes. That makes
// QR_BASE_URL the single most consequential value in the codebase — once a code
// is printed, the origin baked into it can never be corrected without a
// reprint. It is read from the environment (never hardcoded) so the print
// domain is an explicit, deliberate deployment decision.

import { business } from "@/lib/content";

// One password, every dashboard — reuse the signed admin cookie the WiFi,
// Reviews and Play & Win dashboards already use.
export { ADMIN_COOKIE } from "@/lib/wifi/config";

export const TENANT_ID = business.id;

// The origin printed into every QR. Set QR_BASE_URL in production *before*
// generating artwork for a print run.
const RAW_BASE = process.env.QR_BASE_URL?.trim() || "http://localhost:3000";

// Normalized once: no trailing slash, so `${QR_BASE_URL}/q/${code}` is always
// well-formed regardless of how it was entered.
export const QR_BASE_URL = RAW_BASE.replace(/\/+$/, "");

// True when the base URL still points somewhere that can't be scanned by a
// guest's phone. The dashboard surfaces this as a "don't print yet" warning
// rather than silently generating artwork against a dead origin.
export const QR_BASE_IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$|\/)/i.test(
  QR_BASE_URL,
);

export const RESOLVER_PATH = "q";

export function permanentUrlFor(code: string): string {
  return `${QR_BASE_URL}/${RESOLVER_PATH}/${code}`;
}

// —————————————————————————————— input limits

export const MAX_URL_CHARS = 2048;
export const MAX_LABEL_CHARS = 80;
export const MAX_CODE_CHARS = 32;

// —————————————————————————————— abuse control

// The resolver is the only fully public, unauthenticated endpoint in this
// feature. A real guest scans a handful of times; this ceiling exists purely so
// scan analytics can't be cheaply polluted. Matches the shape of Play & Win's
// analytics-event limiter (EVENT_IP_RULE) — generous enough to be invisible to
// a table of guests sharing one venue IP.
export const SCAN_IP_RULE = { max: 800, window: 60 * 60 } as const;

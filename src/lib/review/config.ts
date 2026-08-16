// Constants and resolved limits for the Review Experience. Tenant-facing
// settings live in content.ts (`review`); this file holds the hard limits and
// operational knobs that protect the system regardless of tenant config.

import { business, review } from "@/lib/content";

// Reuse the WiFi admin session — one password, both dashboards. (See
// /api/wifi/admin/login; the cookie is a generic signed admin token.)
export { ADMIN_COOKIE } from "@/lib/wifi/config";

export const TENANT_ID = business.id;

// —————————————————————————————— input limits (server-enforced)

export const MAX_FEEDBACK_CHARS = 4000;
export const MAX_NAME_CHARS = 80;
export const MAX_TABLE_CHARS = 24;
export const MAX_META_BYTES = 2000;

// Photos. The spec allows 10 MB per file at the picker; the client compresses
// hard before upload, and we reject anything still over MAX_STORED after that —
// a guard against a crafted payload bypassing the client compressor.
export const MAX_IMAGES = review.maxImages;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — pre-compression cap
export const MAX_STORED_BYTES = 900 * 1024; // ~0.9 MB — post-compression cap
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

// —————————————————————————————— abuse control

// One full submission per device per minute; a generous daily ceiling; and an
// IP ceiling so a single network can't flood the table. Tuned like the OTP
// limits — strict enough to stop scripts, invisible to a real guest.
export const SUBMIT_RULES = {
  perDeviceCooldown: { max: 1, window: 60 },
  perDeviceDaily: { max: 20, window: 60 * 60 * 24 },
  perIpHourly: { max: 40, window: 60 * 60 },
} as const;

// Analytics events are cheap but must not be a spam vector either.
export const EVENT_IP_RULE = { max: 600, window: 60 * 60 } as const;

// Duplicate-submission window: the same device sending near-identical feedback
// inside this window is dropped (idempotent — we return the first row's id).
export const DUPLICATE_WINDOW_SECONDS = Number(
  process.env.REVIEW_DUPLICATE_WINDOW_SECONDS || 60 * 60 * 6
);

// —————————————————————————————— resolved tenant settings

// A single accessor so components/actions never poke at content.ts shape
// directly and every default lives in one place.
export function reviewSettings() {
  return {
    googleUrl: review.googleUrl,
    googleThreshold: clampThreshold(review.googleThreshold),
    privateFeedback: review.privateFeedback,
    imageUploads: review.imageUploads,
    maxImages: MAX_IMAGES,
    successMessage: review.successMessage,
    smartRecovery: review.smartRecovery,
  };
}

function clampThreshold(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.min(5, Math.max(1, Math.round(n)));
}

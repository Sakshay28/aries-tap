"use server";

// The two write paths of the Review Experience, as Server Actions (invoked
// directly from the client island — no bespoke API routes needed). Both treat
// their input as hostile: a Server Action is reachable by a raw POST that never
// touched our UI, so every value is re-validated here.
//
//   recordEvent   — best-effort funnel telemetry; never throws to the client.
//   submitFeedback — the guarded pipeline: turnstile → validate → rate-limit →
//                    dedupe → store photos → insert → AI triage → notify.

import { headers } from "next/headers";
import { verifyTurnstile } from "@/lib/wifi/request";
import { analyzeFeedback } from "./ai";
import { MAX_META_BYTES, TENANT_ID, reviewSettings } from "./config";
import { clientContext, clientIp, hashIp } from "./context";
import { insertEvent, insertFeedback, updateFeedbackAi } from "./db";
import { notifyNewFeedback } from "./notify";
import {
  checkEventLimit,
  checkSubmitLimits,
  fingerprint,
  recentDuplicateId,
  rememberSubmission,
} from "./ratelimit";
import { persistImages } from "./storage";
import type {
  EventInput,
  FeedbackInput,
  FeedbackRow,
  Rating,
  ReviewEventName,
  SubmitResult,
} from "./types";
import {
  isRating,
  normalizeEmail,
  normalizePhone,
  sanitizeFeedback,
  sanitizeName,
  sanitizeTable,
} from "./validation";

const EVENT_NAMES: ReviewEventName[] = [
  "opened",
  "rating_selected",
  "google_clicked",
  "google_returned",
  "maybe_later",
  "recovery_shown",
  "feedback_started",
  "feedback_submitted",
  "cancelled",
];

// —————————————————————————————— recordEvent

// Fire-and-forget from the client's perspective. Returns a boolean only so the
// offline queue can tell "delivered" from "retry later"; a thrown error is
// swallowed to a false, never surfaced as a broken UI.
export async function recordEvent(input: EventInput): Promise<{ ok: boolean }> {
  try {
    // `feedback_submitted` is authoritative from submitFeedback only, so the
    // funnel can't be inflated by a forged client event.
    if (!EVENT_NAMES.includes(input.name) || input.name === "feedback_submitted") {
      return { ok: false };
    }
    const sessionId = safeId(input.sessionId);
    if (!sessionId) return { ok: false };

    const h = await headers();
    const ipHash = await hashIp(clientIp(h));
    if (!(await checkEventLimit(ipHash))) return { ok: false };

    const ctx = clientContext(h);
    await insertEvent({
      tenantId: TENANT_ID,
      sessionId,
      name: input.name,
      rating: isRating(input.rating) ? input.rating : null,
      meta: cleanMeta(input.meta),
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      country: ctx.country,
      city: ctx.city,
      ipHash,
      userAgent: (h.get("user-agent") || "").slice(0, 400),
    });
    return { ok: true };
  } catch (err) {
    console.error("[review] recordEvent failed", err);
    return { ok: false };
  }
}

// —————————————————————————————— submitFeedback

export async function submitFeedback(input: FeedbackInput): Promise<SubmitResult> {
  try {
    const settings = reviewSettings();
    if (!settings.privateFeedback) {
      return { ok: false, error: "Private feedback isn't enabled for this venue." };
    }

    const rating = Number(input.rating);
    if (!isRating(rating)) return { ok: false, error: "Please choose a rating first." };

    const sessionId = safeId(input.sessionId);
    const deviceId = safeId(input.deviceId);
    if (!sessionId || !deviceId) {
      return { ok: false, error: "Your session expired — please try again." };
    }

    const h = await headers();
    const ip = clientIp(h);

    // Bot defence (optional — a no-op until Turnstile is configured).
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      return { ok: false, error: "Verification failed. Please try again." };
    }

    const ipHash = await hashIp(ip);

    // Throttle before doing any real work.
    const limit = await checkSubmitLimits(deviceId, ipHash);
    if (!limit.ok) return { ok: false, error: limit.reason, retryAfter: limit.retryAfter };

    // Clean the text before it's fingerprinted or stored.
    const feedback = sanitizeFeedback(input.feedback);
    const name = input.contactRequested ? sanitizeName(input.name) : "";
    const email = input.contactRequested ? normalizeEmail(input.email) : "";
    const phone = input.contactRequested ? normalizePhone(input.phone) : "";
    const table = sanitizeTable(input.table);

    // Idempotency: a double-tap, a retrying offline queue, or a rage-refresh
    // all collapse to one row.
    const fp = await fingerprint(deviceId, rating, feedback);
    const existing = await recentDuplicateId(fp);
    if (existing) return { ok: true, id: existing, duplicate: true };

    // Validate + persist photos (bad ones are dropped, not fatal).
    const { urls } = settings.imageUploads
      ? await persistImages(input.images)
      : { urls: [] as string[] };

    const ctx = clientContext(h);

    // Insert first (AI is best-effort and can fill in a beat later).
    const { id, createdAt } = await insertFeedback({
      tenantId: TENANT_ID,
      sessionId,
      rating: rating as Rating,
      feedback,
      images: urls,
      name,
      phone,
      email,
      contactRequested: Boolean(input.contactRequested),
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      country: ctx.country,
      city: ctx.city,
      table,
      ai: null,
      ipHash,
    });

    await rememberSubmission(fp, id);

    // AI triage — heuristic is instant; Gemini is time-boxed inside analyze().
    const ai = await analyzeFeedback({
      rating,
      feedback,
      contactRequested: Boolean(input.contactRequested),
      hasImages: urls.length > 0,
    });
    await updateFeedbackAi(id, ai);

    // Alert the venue + record the authoritative funnel event. Both are
    // best-effort and must not delay the guest's confirmation.
    const row: FeedbackRow = {
      id,
      tenantId: TENANT_ID,
      sessionId,
      rating: rating as Rating,
      feedback,
      images: urls,
      name,
      phone,
      email,
      contactRequested: Boolean(input.contactRequested),
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      country: ctx.country,
      city: ctx.city,
      table,
      ai,
      status: "open",
      resolvedBy: "",
      resolvedAt: null,
      notes: "",
      createdAt,
      updatedAt: createdAt,
    };
    void notifyNewFeedback(row);

    await insertEvent({
      tenantId: TENANT_ID,
      sessionId,
      name: "feedback_submitted",
      rating: rating as Rating,
      meta: {
        table,
        photos: urls.length,
        ...(typeof input.timeMs === "number" && input.timeMs > 0
          ? { timeMs: Math.min(input.timeMs, 1000 * 60 * 30) }
          : {}),
      },
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      country: ctx.country,
      city: ctx.city,
      ipHash,
      userAgent: (h.get("user-agent") || "").slice(0, 400),
    });

    return { ok: true, id };
  } catch (err) {
    console.error("[review] submitFeedback failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// NOTE: the admin dashboard read lives in the /api/review/admin route handler,
// behind the signed admin cookie — deliberately NOT here. A `"use server"`
// export is a public POST endpoint, so exposing "list all feedback" as an
// action would leak every complaint to anyone. Writers only in this file.

// —————————————————————————————— helpers

// Accept only our own client ids: UUID-ish, bounded, no surprises.
function safeId(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : "";
}

// Keep event metadata small, flat, and free of accidental PII shapes.
function cleanMeta(
  meta: EventInput["meta"]
): Record<string, string | number | boolean> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, string | number | boolean> = {};
  let budget = MAX_META_BYTES;
  for (const [k, v] of Object.entries(meta)) {
    if (!/^[a-zA-Z0-9_]{1,32}$/.test(k)) continue;
    let val: string | number | boolean;
    if (typeof v === "number") val = Number.isFinite(v) ? v : 0;
    else if (typeof v === "boolean") val = v;
    else if (typeof v === "string") val = v.slice(0, 120);
    else continue;
    budget -= k.length + String(val).length;
    if (budget < 0) break;
    out[k] = val;
  }
  return out;
}

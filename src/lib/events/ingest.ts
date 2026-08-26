// The one write path for the unified event stream. Every producer — the NFC
// resolver, the WhatsApp redirect, the review bridge, the public beacon — funnels
// through here, so validation, tenant attribution, context derivation, rate
// limiting, idempotency, persistence and realtime publish happen in exactly one
// place and can't drift.
//
// Treats its input as hostile: a public beacon reaches this with attacker-
// controlled fields, so the tenant is never read from the client — it is derived
// server-side from the tag's authoritative owner (or from a tenant a trusted
// server producer already resolved), device/geo come from headers, and meta is
// clamped hard. Sending someone else's tag code can only ever file the event
// under that tag's real owner; a disabled or revoked tag files nothing.

import { clientContext, clientIp, hashIp } from "@/lib/review/context";
import { store } from "@/lib/wifi/store";
import { publishEvent } from "@/lib/realtime/bus";
import {
  EVENT_IP_RULE,
  EVENT_SESSION_RULE,
  MAX_META_BYTES,
  MAX_META_KEYS,
  MAX_SESSION_CHARS,
  MAX_TAG_CODE_CHARS,
} from "./config";
import { insertTapEvent } from "./db";
import { attributeTenant, type AttributionReason } from "./attribution";
import { resolveTagOwner } from "./tag-registry";
import { logEvent } from "./log";
import type { TagIdentity } from "./tags";
import {
  isTapEventType,
  type NewTapEvent,
  type TapEvent,
  type TapEventMeta,
} from "./types";

export type IngestResult =
  | { ok: true; event: TapEvent; deduped: boolean }
  | { ok: false; error: string; retryAfter?: number };

// How a trusted server producer tells ingest which tenant an event belongs to.
// `tenantId` is a tenant the producer already resolved server-side (the WhatsApp
// redirect and review bridge use the deployment tenant). `tag` is a tag identity
// the producer already looked up (the NFC resolver passes the row it fetched, so
// ingest need not hit the registry again). `requireActiveTag` marks an event
// that MUST originate from a real, active tag (a physical NFC tap): then an
// unknown/disabled/revoked tag is refused rather than falling back to a tenant.
export type IngestOptions = {
  rateLimit?: boolean;
  tenantId?: string | null;
  tag?: TagIdentity | null;
  requireActiveTag?: boolean;
};

// Accept only our own opaque client ids: bounded, url-safe, no surprises.
function safeId(v: unknown, max = MAX_SESSION_CHARS): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return new RegExp(`^[A-Za-z0-9_-]{6,${max}}$`).test(s) ? s : "";
}

// Tag codes are the printed identifiers; allow the same alphabet the QR
// validator uses, uppercased and bounded.
function safeTagCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return /^[A-Z0-9._-]{1,32}$/.test(s) && s.length <= MAX_TAG_CODE_CHARS ? s : null;
}

function cleanMeta(meta: TapEventMeta | undefined): TapEventMeta {
  if (!meta || typeof meta !== "object") return {};
  const out: TapEventMeta = {};
  let budget = MAX_META_BYTES;
  let keys = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (keys >= MAX_META_KEYS) break;
    if (!/^[a-zA-Z0-9_]{1,32}$/.test(k)) continue;
    let val: string | number | boolean;
    if (typeof v === "number") val = Number.isFinite(v) ? v : 0;
    else if (typeof v === "boolean") val = v;
    else if (typeof v === "string") val = v.slice(0, 160);
    else continue;
    budget -= k.length + String(val).length;
    if (budget < 0) break;
    out[k] = val;
    keys++;
  }
  return out;
}

function ratingOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// Guest-safe messages for the handful of refusal reasons. The dashboard never
// shows these (rejections aren't events); they're for the API callers and logs.
function rejectionMessage(reason: AttributionReason): string {
  switch (reason) {
    case "tag_disabled":
      return "This tag is disabled.";
    case "tag_revoked":
      return "This tag is no longer active.";
    case "unknown_tag":
      return "Unknown tag.";
    case "no_tenant":
      return "Could not attribute event.";
  }
}

// The core. `rateLimit` guards the public surfaces (beacon, redirects); trusted
// server producers (the review bridge) can skip it since they've already run
// their own throttles.
export async function ingestEvent(
  input: NewTapEvent,
  headers: Headers,
  opts: IngestOptions = {}
): Promise<IngestResult> {
  try {
    if (!isTapEventType(input.type)) return { ok: false, error: "Unknown event type." };

    const sessionId = safeId(input.sessionId);
    // Page/redirect events can be sessionless in edge cases; only reject when a
    // session was supplied but malformed, to avoid silently miscounting.
    if (input.sessionId && !sessionId) return { ok: false, error: "Bad session id." };

    const tagCode = safeTagCode(input.tagCode);

    // —— tenant attribution (authoritative, never from the client) ——
    // Resolve the tag's owner only when we need it: a trusted producer that
    // already knows the tenant (and isn't asserting a physical tap) skips the
    // registry hit entirely.
    let tag = opts.tag ?? null;
    if (!tag && tagCode && (opts.requireActiveTag || !opts.tenantId)) {
      tag = await resolveTagOwner(tagCode);
    }
    const attribution = attributeTenant({
      tag,
      requireActiveTag: opts.requireActiveTag ?? false,
      trustedTenant: opts.tenantId ?? null,
    });
    if (!attribution.ok) {
      logEvent("ingest_rejected", { type: input.type, tagCode, reason: attribution.reason });
      return { ok: false, error: rejectionMessage(attribution.reason) };
    }
    const tenantId = attribution.tenantId;

    const ip = clientIp(headers);
    const ipHash = await hashIp(ip);

    if (opts.rateLimit) {
      const ipHits = await store.incrWithTtl(`evt:ip:${ipHash}`, EVENT_IP_RULE.window);
      if (ipHits > EVENT_IP_RULE.max) return { ok: false, error: "Too many events.", retryAfter: EVENT_IP_RULE.window };
      if (sessionId) {
        const sHits = await store.incrWithTtl(`evt:s:${sessionId}`, EVENT_SESSION_RULE.window);
        if (sHits > EVENT_SESSION_RULE.max) return { ok: false, error: "Too many events.", retryAfter: EVENT_SESSION_RULE.window };
      }
    }

    const ctx = clientContext(headers);
    const { event, created } = await insertTapEvent(tenantId, {
      type: input.type,
      tagCode: tag ? tag.code : tagCode,
      sessionId,
      visitorId: safeId(input.visitorId ?? "", MAX_SESSION_CHARS) || null,
      rating: ratingOrNull(input.rating),
      meta: cleanMeta(input.meta),
      source: input.source,
      idempotencyKey: input.idempotencyKey ?? null,
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      country: ctx.country,
      city: ctx.city,
    });

    // Only fresh writes are news — a deduped retry must not double-count in any
    // open dashboard. Publish is tenant-scoped inside the bus, so an event only
    // ever reaches its own tenant's dashboards.
    if (created) publishEvent(event);

    logEvent("ingest_ok", {
      type: event.type,
      tenantId,
      tagCode: event.tagCode ?? undefined,
      eventId: event.id,
      source: event.source,
      persisted: true,
      published: created,
      deduped: !created,
    });

    return { ok: true, event, deduped: !created };
  } catch (err) {
    logEvent("ingest_error", { type: input.type, message: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Could not record event." };
  }
}

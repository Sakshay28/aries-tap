// The one authoritative event vocabulary for Aries Tap.
//
// Before this file there were two disconnected trackers — `qr_scans` (NFC/QR
// taps) and `review_events` (the review funnel). The owner dashboard needs a
// single stream it can subscribe to, count, and replay, so every guest-facing
// interaction now also lands as a `TapEvent`. This is the shape that crosses
// the client ↔ server ↔ database ↔ realtime boundary; keep it append-only.

// Append-only. Historical rows are keyed by these exact strings — never rename
// or repurpose one; add new ones instead. The dashboard is written against the
// union, not a hardcoded three, so a new type shows up in the feed for free.
export const TAP_EVENT_TYPES = [
  "NFC_TAP", // a physical Aries Tap tag/card was tapped (the /q/[code] resolver)
  "WHATSAPP_CLICK", // the WhatsApp CTA was used (tracked /go/whatsapp/[code] redirect)
  "PROFILE_VIEW", // the venue landing/lobby page was opened
  "CTA_CLICK", // any other call-to-action on the landing page
  "REVIEW_STARTED", // the review modal was opened
  "REVIEW_RECEIVED", // a star rating was captured (carries `rating`)
  "REVIEW_SUBMITTED", // private feedback was stored (authoritative, server-only)
] as const;

export type TapEventType = (typeof TAP_EVENT_TYPES)[number];

export function isTapEventType(v: unknown): v is TapEventType {
  return typeof v === "string" && (TAP_EVENT_TYPES as readonly string[]).includes(v);
}

// Where an event was minted. Lets the dashboard distinguish a server-attributed
// event (a redirect we controlled) from a best-effort client beacon.
export type TapEventSource = "resolver" | "redirect" | "server" | "client";

export const TAP_EVENT_SOURCES: readonly TapEventSource[] = [
  "resolver",
  "redirect",
  "server",
  "client",
];

// Small, flat, PII-free bag of extras: { rating, table, screen, label, … }.
export type TapEventMeta = Record<string, string | number | boolean>;

// What a caller hands the ingest pipeline. Untrusted at the client edge — the
// pipeline re-derives device/geo server-side and re-validates every field.
export type NewTapEvent = {
  type: TapEventType;
  // The printed tag identifier (a `qr_codes.code`), when the interaction can be
  // attributed to a specific physical tag. Null for page-level events.
  tagCode: string | null;
  // Opaque per-session id (a client UUID). Never a real identity.
  sessionId: string;
  // Opaque per-device token — lets us count unique visitors without PII.
  visitorId?: string | null;
  rating?: number | null;
  meta?: TapEventMeta;
  source: TapEventSource;
  // Optional caller-supplied dedupe key. Two writes with the same key inside the
  // idempotency window collapse to one row (double-tap, retried beacon).
  idempotencyKey?: string | null;
};

// A stored event, as the dashboard and realtime stream read it back. `tenantId`
// is the single-tenant deployment key (`business.id`) — the moral equivalent of
// the spec's `businessId`, resolved server-side and never trusted from a client.
export type TapEvent = {
  id: string;
  tenantId: string;
  type: TapEventType;
  tagCode: string | null;
  sessionId: string;
  visitorId: string | null;
  rating: number | null;
  meta: TapEventMeta;
  source: TapEventSource;
  device: string;
  browser: string;
  os: string;
  country: string;
  city: string;
  createdAt: string; // authoritative UTC ISO — the UI localizes; storage never does
};

// A stable, sortable cursor for the activity feed and the SSE resync. Encodes
// (createdAt, id) so pagination is total-ordered even when two events share a
// millisecond. Opaque to the client — treat as a token.
export type ActivityCursor = string;

export function encodeCursor(createdAt: string, id: string): ActivityCursor {
  return `${createdAt}|${id}`;
}

export function decodeCursor(
  cursor: string | null | undefined
): { createdAt: string; id: string } | null {
  if (!cursor || typeof cursor !== "string") return null;
  const i = cursor.lastIndexOf("|");
  if (i <= 0) return null;
  const createdAt = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  if (Number.isNaN(Date.parse(createdAt)) || !id) return null;
  return { createdAt, id };
}

// —————————————————————————————— dashboard read models

export type SeriesPoint = { date: string; count: number };

export type TagStat = {
  code: string;
  label: string;
  isActive: boolean;
  taps: number; // NFC taps attributed to this tag (all time)
  tapsToday: number;
  lastActivity: string | null;
};

// Everything the Overview cards need, computed once server-side. The client
// receives numbers, never raw events (except the recent-activity slice).
export type OverviewMetrics = {
  totalTaps: number; // NFC_TAP, all time
  tapsToday: number;
  whatsappClicks: number;
  whatsappClicksToday: number;
  reviews: number; // distinct sessions that produced a rating or submission
  averageRating: number;
  profileViews: number;
  // NFC tap → WhatsApp click, as a percentage. A measured funnel edge, not an
  // estimate — both ends are real events.
  conversionRate: number;
  activeTags: number;
  totalEvents: number;
  taps14d: SeriesPoint[]; // NFC taps per day, last 14 days (UTC buckets)
  topTags: TagStat[];
  generatedAt: string;
};

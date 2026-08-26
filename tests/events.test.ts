// Unit tests for the pure core of the event system — the analytics fold and the
// cursor codec. These are the reference definitions the SQL aggregation in
// db.ts must match, so they're the highest-value thing to pin down. Zero deps:
// run with `npm test` (Node's built-in test runner + native TS stripping).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeCursor,
  encodeCursor,
  isTapEventType,
  type TapEvent,
} from "../src/lib/events/types.ts";
import { computeOverview, type TagInfo } from "../src/lib/events/analytics.ts";

// —————————————————————————————— fixtures

let seq = 0;
function ev(partial: Partial<TapEvent> & { type: TapEvent["type"] }): TapEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    tenantId: "taffeta",
    tagCode: null,
    sessionId: "",
    visitorId: null,
    rating: null,
    meta: {},
    source: "server",
    device: "",
    browser: "",
    os: "",
    country: "",
    city: "",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

const TAGS: TagInfo[] = [
  { code: "AT001", label: "Table 1", isActive: true },
  { code: "AT002", label: "Table 2", isActive: false },
];

// —————————————————————————————— cursor codec

test("cursor round-trips (createdAt, id)", () => {
  const c = encodeCursor("2026-08-25T10:00:00.000Z", "abc-123");
  assert.equal(c, "2026-08-25T10:00:00.000Z|abc-123");
  assert.deepEqual(decodeCursor(c), {
    createdAt: "2026-08-25T10:00:00.000Z",
    id: "abc-123",
  });
});

test("cursor rejects malformed input", () => {
  assert.equal(decodeCursor(null), null);
  assert.equal(decodeCursor(""), null);
  assert.equal(decodeCursor("no-pipe"), null);
  assert.equal(decodeCursor("|only-id"), null);
  assert.equal(decodeCursor("not-a-date|x"), null);
});

test("isTapEventType guards the union", () => {
  assert.equal(isTapEventType("NFC_TAP"), true);
  assert.equal(isTapEventType("WHATSAPP_CLICK"), true);
  assert.equal(isTapEventType("DROP TABLE"), false);
  assert.equal(isTapEventType(42), false);
});

// —————————————————————————————— overview fold

test("overview counts taps, today, and active tags", () => {
  // Time-relative so the 14-day "today" bucket (which the pure series builds
  // against the real clock) always lines up, regardless of when the suite runs.
  const now = new Date();
  const today = now.toISOString();
  const yesterday = new Date(now.getTime() - 864e5).toISOString();
  const events = [
    ev({ type: "NFC_TAP", tagCode: "AT001", sessionId: "s1", createdAt: today }),
    ev({ type: "NFC_TAP", tagCode: "AT001", sessionId: "s2", createdAt: today }),
    ev({ type: "NFC_TAP", tagCode: "AT002", sessionId: "s3", createdAt: yesterday }),
  ];
  const o = computeOverview(events, TAGS, now);
  assert.equal(o.totalTaps, 3);
  assert.equal(o.tapsToday, 2);
  assert.equal(o.activeTags, 1); // only AT001 is active
  assert.equal(o.taps14d.length, 14);
  assert.equal(o.taps14d[13].count, 2); // today's bucket
});

test("conversion is session-scoped tap → WhatsApp", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const events = [
    ev({ type: "NFC_TAP", sessionId: "s1", createdAt: now.toISOString() }),
    ev({ type: "WHATSAPP_CLICK", sessionId: "s1", createdAt: now.toISOString() }),
    ev({ type: "NFC_TAP", sessionId: "s2", createdAt: now.toISOString() }),
  ];
  const o = computeOverview(events, TAGS, now);
  assert.equal(o.whatsappClicks, 1);
  assert.equal(o.conversionRate, 50); // 1 of 2 tap-sessions converted
});

test("reviews count distinct sessions; average uses last rating per session", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const events = [
    ev({ type: "REVIEW_RECEIVED", sessionId: "s3", rating: 3, createdAt: "2026-08-25T11:00:00.000Z" }),
    ev({ type: "REVIEW_RECEIVED", sessionId: "s3", rating: 5, createdAt: "2026-08-25T11:05:00.000Z" }), // later wins
    ev({ type: "REVIEW_SUBMITTED", sessionId: "s3", rating: 5, createdAt: "2026-08-25T11:06:00.000Z" }),
    ev({ type: "REVIEW_RECEIVED", sessionId: "s4", rating: 1, createdAt: now.toISOString() }),
  ];
  const o = computeOverview(events, TAGS, now);
  assert.equal(o.reviews, 2); // s3 and s4
  assert.equal(o.averageRating, 3); // (5 + 1) / 2 — s3 settles on 5
});

test("topTags: zero-tap registry tags still appear, sorted by taps", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const events = [
    ev({ type: "NFC_TAP", tagCode: "AT002", sessionId: "s1", createdAt: now.toISOString() }),
  ];
  const o = computeOverview(events, TAGS, now);
  const codes = o.topTags.map((t) => t.code);
  assert.ok(codes.includes("AT001")); // zero-tap tag present
  assert.ok(codes.includes("AT002"));
  assert.equal(o.topTags[0].code, "AT002"); // most taps first
  assert.equal(o.topTags[0].taps, 1);
});

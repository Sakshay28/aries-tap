// Shared vocabulary for the Review Experience. One place for every shape that
// crosses the client ↔ server ↔ database boundary, so the funnel, the form, the
// action and the dashboard can never drift apart.

export type Rating = 1 | 2 | 3 | 4 | 5;

// The funnel, in order. Each customer interaction emits exactly one of these so
// the dashboard can compute conversion, abandonment and completion time without
// guessing. Keep this list append-only — historical rows depend on the strings.
export type ReviewEventName =
  | "opened" // modal shown
  | "rating_selected" // a star was chosen
  | "google_clicked" // sent to Google (happy path)
  | "google_returned" // came back / regained focus after Google
  | "maybe_later" // declined the Google invite
  | "recovery_shown" // Smart Review Recovery offer displayed
  | "feedback_started" // began typing private feedback
  | "feedback_submitted" // private feedback stored
  | "cancelled"; // closed before completing

// Manager resolution workflow for a piece of private feedback.
export type ReviewStatus = "open" | "in_progress" | "resolved" | "closed";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

// What the AI (or the heuristic fallback) extracts from a complaint so a manager
// can triage at a glance and reply fast.
export type AiPriority = "low" | "medium" | "high";
export type AiSeverity = "minor" | "moderate" | "critical";
export type AiCategory =
  | "food"
  | "service"
  | "ambience"
  | "cleanliness"
  | "pricing"
  | "staff"
  | "other";

export type AiAnalysis = {
  summary: string;
  priority: AiPriority;
  department: string;
  severity: AiSeverity;
  categories: AiCategory[];
  suggestedResponse: string;
  // "gemini" when the model produced it, "heuristic" when we fell back — shown
  // as a small badge in the dashboard so managers know how to weight it.
  source: "gemini" | "heuristic";
};

// Device/browser context we derive server-side from the User-Agent + geo
// headers. Deliberately coarse — enough to spot patterns, never fingerprinting.
export type ClientContext = {
  device: string; // "iPhone", "Android", "Desktop", …
  browser: string; // "Safari", "Chrome", …
  os: string; // "iOS", "Android", "macOS", …
  country: string; // ISO-2 or ""
  city: string; // "" when unknown
};

// —————————————————————————————— feedback

// What the client sends to the submit action. Untrusted — every field is
// re-validated server-side before it touches the database.
export type FeedbackInput = {
  sessionId: string;
  deviceId: string; // persistent per-device token (localStorage UUID)
  rating: number;
  feedback: string;
  images: string[]; // compressed data: URLs, validated + capped server-side
  name?: string;
  phone?: string;
  email?: string;
  contactRequested: boolean;
  table?: string; // from the NFC/QR deep link, e.g. ?t=12
  timeMs?: number; // time spent in the modal, for the funnel
  turnstileToken?: string;
};

export type SubmitResult =
  | { ok: true; id: string; duplicate?: boolean }
  | { ok: false; error: string; retryAfter?: number };

// A stored complaint, as the dashboard reads it back.
export type FeedbackRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  rating: Rating;
  feedback: string;
  images: string[];
  name: string;
  phone: string;
  email: string;
  contactRequested: boolean;
  device: string;
  browser: string;
  os: string;
  country: string;
  city: string;
  table: string;
  ai: AiAnalysis | null;
  status: ReviewStatus;
  resolvedBy: string;
  resolvedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

// —————————————————————————————— events

export type EventInput = {
  sessionId: string;
  name: ReviewEventName;
  rating?: number;
  // Small bag of extras: { timeMs, table, screen, … }. Never PII.
  meta?: Record<string, string | number | boolean>;
};

export type EventRow = EventInput & {
  id: string;
  tenantId: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  city: string;
  createdAt: string;
};

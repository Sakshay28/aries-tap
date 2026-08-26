// Operational constants for the unified event system + owner dashboard.
//
// Deliberately free of any content/Next imports so the whole event *core*
// (config → db → analytics → attribution → bus) can be imported by the Node
// test runner with nothing configured — no database, no `@/` alias, no image
// modules. Tenant identity (which needs venue content) and the owner-session
// auth live in ./tenant, imported only by the server routes, never by tests.

// —————————————————————————————— input limits (server-enforced)

export const MAX_SESSION_CHARS = 64;
export const MAX_TAG_CODE_CHARS = 32;
export const MAX_META_BYTES = 2000;
export const MAX_META_KEYS = 24;

// —————————————————————————————— abuse control

// The public ingest endpoint (`POST /api/events`) and the tracked redirects are
// unauthenticated. These ceilings are generous enough to be invisible to a
// table of guests sharing one venue IP, strict enough that analytics can't be
// cheaply polluted. Same shape as the review/QR limiters already in the repo.
export const EVENT_IP_RULE = { max: 800, window: 60 * 60 } as const; // per hour
export const EVENT_SESSION_RULE = { max: 240, window: 60 * 60 } as const;

// How long two writes carrying the same idempotency key collapse to one row.
export const IDEMPOTENCY_WINDOW_SECONDS = Number(
  process.env.EVENT_IDEMPOTENCY_WINDOW_SECONDS || 60 * 10
);

// The activity feed and SSE resync never hand back an unbounded set.
export const ACTIVITY_PAGE_SIZE = 40;
export const ACTIVITY_MAX_PAGE_SIZE = 100;
// A reconnecting dashboard asks for everything it missed; cap the catch-up so a
// client that was away for a week can't pull the whole table in one frame.
export const RESYNC_MAX_EVENTS = 200;

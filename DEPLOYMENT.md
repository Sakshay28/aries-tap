# Aries Tap — Production Deployment

This covers the **event / dashboard / realtime subsystem** (NFC taps → owner
dashboard). The consumer landing page, WiFi, Reviews and Play & Win reuse the
same infrastructure (one database, one admin secret) and are covered by the same
environment variables below.

One deployment serves **one venue** (`business.id` in `src/lib/content.ts`). The
event subsystem is multi-tenant internally — every event is owned by the tag's
tenant, every dashboard read is scoped to the authenticated owner's tenant — so
the same database and code safely hold many venues if you ever run them together.

---

## 1. Required production infrastructure

| Need | What | Notes |
|------|------|-------|
| App hosting | Vercel (or any Node host) | Serverless-safe; see §5. |
| Database | **Postgres** (Neon or Vercel Postgres) | The durable source of truth. **Required** — production refuses to start on the JSON fallback (see §4). |
| Realtime | In-process **or** Ably | In-process is fine for a single always-warm instance; Ably is required for multi-instance scale (§3). |
| Rate-limit store | Upstash Redis (REST) | Optional but strongly recommended; without it the limiter falls back to per-instance memory. |
| Domain + HTTPS | Your printed QR origin | `QR_BASE_URL` must be the real HTTPS origin **before** printing tags. |
| Auth secret | `WIFI_SESSION_SECRET` | Signs the admin/session cookies. **Required** in production. |
| Admin password | `ADMIN_PASSWORD` | Gates every dashboard. **Required** in production. |

### Environment variables

Copy `.env.example` and set, at minimum, for production:

```
DATABASE_URL=postgres://…                 # durable events (required)
WIFI_SESSION_SECRET=<openssl rand -hex 32> # cookie signing (required)
ADMIN_PASSWORD=<strong password>           # dashboard login (required)
QR_BASE_URL=https://your-domain            # printed QR origin (required before printing)
UPSTASH_REDIS_REST_URL=…                   # rate limiting (recommended)
UPSTASH_REDIS_REST_TOKEN=…

# Realtime — pick one:
#   (unset)                → in-process broker (single instance)
#   ARIES_REALTIME=ably    → managed multi-instance (needs ABLY_API_KEY)
ARIES_REALTIME=
ABLY_API_KEY=                              # SERVER-side only, never NEXT_PUBLIC_*
```

`.env.example` documents the full list (Reviews webhooks, Turnstile, Gemini,
etc.). Secrets are **never** committed: `.env*` is git-ignored except
`.env.example`, which holds names only.

**Fail-closed guards** (so a misconfigured production never runs insecurely):
- No `DATABASE_URL` → the event store **throws** rather than silently using the
  ephemeral per-instance JSON file.
- No `WIFI_SESSION_SECRET` → cookie signing **refuses** the public dev key.
- No `ADMIN_PASSWORD` → admin login returns 503 instead of accepting `admin`.

---

## 2. Required setup

1. **Provision Postgres** and copy its connection string to `DATABASE_URL`.
2. **Migrate the schema** — nothing to run by hand. The store creates its tables
   and indexes with `CREATE TABLE / INDEX IF NOT EXISTS` on first query
   (`src/lib/events/db.ts`, `src/lib/qr/db.ts`). The schema is deterministic and
   idempotent, so the first request (or the CI acceptance job) bootstraps it.
3. **Configure environment** (Vercel Project Settings → Environment Variables, or
   your host's equivalent). Set the required vars from §1.
4. **Build**: `npm run build`.
5. **Deploy** (Vercel: push to the production branch, or `vercel --prod`).
6. **Verify** with the first-production checklist in §6 / `docs/PRODUCTION-VERIFICATION.md`.

---

## 3. Realtime modes — and why

| Mode | Config | When |
|------|--------|------|
| **In-process** | `ARIES_REALTIME` unset | Local dev, and any single always-warm instance. Zero config, zero extra dependency. A tap published by the process reaches every SSE stream **in that process**. |
| **Ably (managed)** | `ARIES_REALTIME=ably` + `ABLY_API_KEY` | Horizontal scale. Across multiple serverless instances the in-process broker can't reach a dashboard held open on a *different* instance; Ably fans every event out to all instances over a tenant-scoped channel. |

Why the DB is still the source of truth in both: a publish happens **only after a
successful persist**, and is best-effort — a broker failure is logged and
swallowed, never corrupting a stored event. On reconnect, the dashboard replays
from its cursor straight out of Postgres, so a dropped realtime message is
recovered on the next reconnect. The broker accelerates delivery; it never owns
the truth. `ABLY_API_KEY` is read server-side only and is never exposed to the
browser — the browser speaks only to our own SSE endpoint.

---

## 4. Data growth / retention

The schema is append-only and indexed for the exact dashboard queries
(`(tenant_id, created_at, id)`, `(tenant_id, type, created_at)`,
`(tenant_id, tag_code, created_at)`). Every dashboard read is bounded — the
activity feed is cursor-paginated (≤100/page), the SSE resync is capped
(≤200 events), the tag list is capped (≤500), and all aggregates are computed in
SQL, never by loading events into app memory. So the table can grow to millions
of rows without changing dashboard cost.

If/when retention becomes desirable, prefer a simple time-based policy over
building a background system, e.g. a scheduled `DELETE FROM tap_events WHERE
created_at < now() - interval '18 months'` (or a Postgres partition drop). Not
needed at current scale — documented here rather than built.

---

## 5. Serverless / Vercel safety

- **Persistence**: production must use Postgres. The JSON fallback writes to
  `os.tmpdir()`, which is per-instance and ephemeral on serverless — the §1 guard
  refuses it in production so this can't happen silently.
- **Realtime**: the in-process bus only fans out within one instance. For
  multi-instance production, use Ably (§3). The bus's subscriber registry is
  bounded (it deletes a tenant's entry when its last subscriber unsubscribes, and
  the SSE route always unsubscribes on disconnect/abort).
- **Rate limiting**: use Upstash in production. The in-memory fallback is
  per-instance and self-reaping (bounded), but only Upstash is shared across
  instances.
- **No persistent server process, queues, or local files are assumed in
  production** beyond Postgres + (optional) Ably + Upstash.

---

## 6. First production verification (deployment-day — NOT yet performed)

Run these once, against the real deployment, after setting the environment. They
require the live site, a real Postgres, and physical tags — see
`docs/PRODUCTION-VERIFICATION.md` for the full tomorrow checklist.

- [ ] Log in to `/admin/overview` with the production `ADMIN_PASSWORD`.
- [ ] Create/verify a tag in the QR admin; confirm its permanent URL uses `QR_BASE_URL`.
- [ ] Tap a real NFC tag with a phone; confirm the dashboard tick + activity row.
- [ ] Click the WhatsApp CTA; confirm a `WHATSAPP_CLICK` event appears.
- [ ] Submit a review; confirm a review event appears.
- [ ] Refresh the dashboard; confirm the numbers persist (from Postgres).
- [ ] Kill the connection ~30s, tap a few times, reconnect; confirm replay with no duplicates.
- [ ] With two venues' tags (or two tenants), confirm each dashboard sees only its own events.

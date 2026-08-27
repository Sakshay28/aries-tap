# Production Verification — Tomorrow's Manual Checklist

Everything here needs a real environment that does **not** exist in the dev
sandbox: a disposable/staging Postgres, real Ably credentials, physical NFC tags,
a real phone, and a deployed site. Each item is either automated by CI once the
resource exists, or a hands-on step. Nothing below has been performed.

---

## A. Database (Postgres)

- [ ] Provide a **disposable** `TEST_DATABASE_URL` (never production Neon).
- [ ] Run the acceptance suite against it and confirm the log says
      `persistence track: Postgres` (the suite asserts this — it fails rather than
      silently using JSON):
      ```
      TEST_DATABASE_URL=postgres://…  npm test
      ```
      Note: `@neondatabase/serverless` speaks Neon's HTTP protocol. Against a
      plain Postgres, run the local Neon HTTP proxy and set
      `NEON_HTTP_PROXY_HOST` / `NEON_HTTP_PROXY_PORT` (the CI workflow
      `.github/workflows/ci.yml` → `postgres-acceptance` does this automatically
      with a `postgres:16` service + `local-neon-http-proxy`). **Validate the CI
      job on its first run** — the proxy wiring hasn't been exercised yet.
- [ ] Confirm migrations are reproducible: drop the schema, run the suite, and
      confirm the `CREATE TABLE/INDEX IF NOT EXISTS` bootstrap recreates it.
- [ ] Inspect indexes and a query plan for the two hot dashboard queries:
      ```sql
      \d+ tap_events
      EXPLAIN ANALYZE SELECT * FROM tap_events
        WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 41;
      EXPLAIN ANALYZE SELECT count(*) FILTER (WHERE type='NFC_TAP')
        FROM tap_events WHERE tenant_id = $1;
      ```
      Confirm `tap_events_tenant_time_idx` / `tap_events_type_idx` are used and no
      sequential scan of the full table occurs.

## B. Realtime (Ably, multi-instance)

- [ ] Set `ARIES_REALTIME=ably` + a real server-side `ABLY_API_KEY`.
- [ ] Deploy to **≥2 instances** (or two `next start` processes on different
      ports sharing one Postgres + one Ably key).
- [ ] Open a dashboard on instance #1; ingest a tap on instance #2; confirm the
      dashboard on #1 updates live. (This is the one thing the mocked adapter
      test cannot prove — it needs a real Ably fan-out across processes.)
- [ ] Open dashboards for two different tenants; confirm no cross-tenant delivery
      (each sees only `tap:<its-tenant>` channel events).

## C. Real NFC

- [ ] Program physical tags to `https://<domain>/q/<CODE>` and register those
      codes in the QR admin.
- [ ] Tap with a real phone; confirm redirect + a dashboard tick within seconds.
- [ ] Tap several tags, including simultaneous taps, and confirm counts are exact
      (no lost or duplicated taps).
- [ ] Disable a tag in the admin, tap it; confirm it does **not** generate an event.

## D. WhatsApp

- [ ] Click the WhatsApp CTA on a real phone; confirm it opens WhatsApp to the
      venue number and a `WHATSAPP_CLICK` event appears on the dashboard.

## E. Reviews

- [ ] Submit a real review (rating + optional feedback/photo); confirm the review
      events and the numbers appear on `/admin/overview` and `/admin/reviews`.

## F. Production deployment

- [ ] Deploy with all required env vars set (`DATABASE_URL`,
      `WIFI_SESSION_SECRET`, `ADMIN_PASSWORD`, `QR_BASE_URL`, Upstash, realtime).
- [ ] Confirm HTTPS and the custom domain resolve, and `QR_BASE_URL` matches the
      printed origin.
- [ ] Confirm admin login works with the production password and that the dev
      default (`admin`) is rejected (503 if `ADMIN_PASSWORD` were unset).
- [ ] Confirm a missing `DATABASE_URL` is refused (the app must not run on JSON).

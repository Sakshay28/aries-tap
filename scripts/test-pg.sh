#!/usr/bin/env bash
# Exercise the acceptance suite against a real, disposable Postgres — the same
# wiring CI's `postgres-acceptance` job uses, but on your machine. Requires
# Docker (and the compose plugin). Nothing here touches a real database.
#
#     ./scripts/test-pg.sh        # or: npm run test:pg
#
# It brings up postgres:16 + the Neon HTTP proxy, runs ONLY the acceptance suite
# against real SQL — the suite asserts it selected the Postgres track and fails
# rather than silently falling back to JSON — then tears the containers down,
# even on failure, and exits with the suite's own status.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker compose version >/dev/null 2>&1; then
  echo "✗ Docker (with the compose plugin) is required. Install Docker Desktop, then re-run." >&2
  exit 127
fi

compose() { docker compose -f docker-compose.test.yml "$@"; }

cleanup() { compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▸ starting disposable Postgres + Neon HTTP proxy…"
compose up -d --wait

echo "▸ running acceptance suite against real Postgres…"
set +e
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/main" \
NEON_HTTP_PROXY_HOST="localhost" \
NEON_HTTP_PROXY_PORT="4444" \
  node --experimental-strip-types --import ./tests/register-hooks.mjs \
  --test tests/acceptance.test.ts
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "✓ acceptance suite passed against real Postgres"
else
  echo "✗ acceptance suite failed against real Postgres (exit $status)" >&2
fi
exit "$status"

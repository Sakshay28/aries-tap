// Authoritative tag identity + lifecycle — the pure half (spec §20).
//
// A physical Aries Tap tag has an *immutable internal identity* (`id`, a uuid
// that never changes) and an *owner* (`tenantId`) that is fixed for that
// identity's whole life. The printed `code` is what a guest taps; it never
// renames (renaming would orphan every printed copy), and because codes are
// globally unique in the registry a given code can only ever belong to one
// tenant. Together these guarantee the property the spec insists on: historical
// events keep their original ownership forever, even if a physical tag is
// retired and a differently-coded tag later takes its place.
//
// Lifecycle is three states. This module maps them; enforcement (reject a
// disabled/revoked tag, attribute an active one to its owner) lives in
// attribution.ts, and both are exercised without a database by the test suite.

// ACTIVE   — redirecting and accepting events right now.
// DISABLED — temporarily off: no normal customer events, but recoverable.
// REVOKED  — permanently retired (soft-archived). Never accepts events again and
//            its code is never rebound to another business.
export type TagStatus = "ACTIVE" | "DISABLED" | "REVOKED";

// The minimal authoritative fact the write path needs about a tag: who owns it
// and whether it may mint events. `id` is the immutable identity; `code` is the
// printed label carried onto each event as a denormalized snapshot.
export type TagIdentity = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  status: TagStatus;
};

// Map the registry's storage columns onto the lifecycle. Kept pure and separate
// from the store so the JSON fallback, the SQL path and the tests all agree on
// exactly one definition. Order matters: a revoked (archived) tag is revoked
// even though it is also inactive.
export function tagStatus(row: { isActive: boolean; archivedAt: string | null }): TagStatus {
  if (row.archivedAt) return "REVOKED";
  if (!row.isActive) return "DISABLED";
  return "ACTIVE";
}

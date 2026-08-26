// The authoritative "who owns this tag, and may it mint events?" resolver — the
// database-backed half of tag identity (the pure half is tags.ts).
//
// Server-only: it reaches the QR/NFC registry (qr_codes), which imports venue
// content, so it never appears in the test-runnable core. Tests exercise the
// decision it feeds (attributeTenant) with in-memory TagIdentity fixtures
// instead, which is why the rule and the lookup are deliberately separate.

import { getQrByCodeGlobal } from "@/lib/qr/db";
import { tagStatus, type TagIdentity } from "./tags";

// Resolve a printed code to its immutable identity, owner and lifecycle, or null
// if no such tag was ever registered. Because codes are globally unique this is
// an unambiguous ownership answer — the value ingest attributes the event to,
// regardless of what the requester claims.
export async function resolveTagOwner(code: string): Promise<TagIdentity | null> {
  const row = await getQrByCodeGlobal(code);
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    label: row.label,
    status: tagStatus({ isActive: row.isActive, archivedAt: row.archivedAt }),
  };
}

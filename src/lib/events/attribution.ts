// Who does an event belong to? — the one authoritative rule (spec §19–§21).
//
// This is a pure function on purpose. The tenant an event is attributed to is
// NEVER read from client input (there is no tenant field on NewTapEvent, and
// there never will be). It is derived here, server-side, from two trusted
// facts: the tag the event names (resolved from the registry, with its owner and
// lifecycle) and the tenant a trusted server producer already established.
//
// The rule, in order:
//   • A tag was named and found → attribute to the tag's OWNER, regardless of
//     anything the caller claims. Sending tag AT001 (owned by A) can only ever
//     land under A — even from a request carrying B's session or B's headers.
//     A DISABLED or REVOKED tag mints nothing (spec §20).
//   • No usable tag, but the caller is a trusted server producer that named a
//     tenant (the NFC resolver passes the tag owner it just looked up; the
//     WhatsApp redirect and review bridge pass the deployment tenant) → use it.
//   • Otherwise → refuse. Better to drop one event than to misattribute it.

import type { TagIdentity } from "./tags";

export type AttributionReason =
  | "tag_disabled"
  | "tag_revoked"
  | "unknown_tag"
  | "no_tenant";

export type Attribution =
  | { ok: true; tenantId: string; tagId: string | null }
  | { ok: false; reason: AttributionReason };

export function attributeTenant(args: {
  // The resolved tag, if the event named a code and it was found in the registry.
  tag?: TagIdentity | null;
  // True when the event *must* come from a real, active tag (a physical NFC tap).
  // Then an unknown/disabled/revoked tag is fatal rather than falling back.
  requireActiveTag?: boolean;
  // A tenant a trusted server producer already established (never client input).
  trustedTenant?: string | null;
}): Attribution {
  const { tag, requireActiveTag = false, trustedTenant = null } = args;

  if (tag) {
    switch (tag.status) {
      case "ACTIVE":
        return { ok: true, tenantId: tag.tenantId, tagId: tag.id };
      case "DISABLED":
        return { ok: false, reason: "tag_disabled" };
      case "REVOKED":
        return { ok: false, reason: "tag_revoked" };
    }
  }

  if (requireActiveTag) return { ok: false, reason: "unknown_tag" };
  if (trustedTenant) return { ok: true, tenantId: trustedTenant, tagId: null };
  return { ok: false, reason: "no_tenant" };
}

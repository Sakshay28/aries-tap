// Server-side validation + sanitization for the claim form. The client validates
// for UX; this is the line that matters, because a Server Action is reachable by
// a raw POST that never touched our form. Dependency-free, small, testable —
// the codebase's house style.

import { normalizeIndianMobile } from "@/lib/wifi/phone";
import { MAX_NAME_CHARS, MAX_TABLE_CHARS } from "./config";

// Accept only our own client ids: UUID-ish, bounded, no surprises.
export function safeId(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : "";
}

function sanitizeText(raw: unknown, maxChars: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxChars);
}

export function sanitizeName(raw: unknown): string {
  return sanitizeText(raw, MAX_NAME_CHARS);
}

export function sanitizeTable(raw: unknown): string {
  return sanitizeText(raw, MAX_TABLE_CHARS)
    .replace(/[^A-Za-z0-9 \-_.]/g, "")
    .trim();
}

// Primary contact — the growth engine's whole point. Normalized to E.164 so the
// per-phone limit and the lead list can't be fooled by formatting. Returns ""
// (invalid) rather than throwing; the caller decides whether it's required.
export function normalizePhoneInput(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return normalizeIndianMobile(raw) ?? "";
}

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().toLowerCase().slice(0, 254);
  if (!v) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : "";
}

// A birthday we can send a treat on. Stored as MM-DD-only? No — we keep the full
// ISO date the guest gave (YYYY-MM-DD) but reject implausible ones (future, or
// older than 120y). The venue only ever uses month/day for the birthday club.
export function normalizeBirthday(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const age = now - d.getTime();
  const year = 365.25 * 24 * 60 * 60 * 1000;
  if (age < 0 || age > 120 * year) return "";
  return v;
}

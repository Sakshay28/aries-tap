// Hand-rolled validation, matching the house style (see review/validation.ts
// and wifi/phone.ts) — no schema library anywhere in this codebase.

import { MAX_CODE_CHARS, MAX_LABEL_CHARS, MAX_URL_CHARS } from "./config";

export type UrlCheck =
  | { ok: true; url: string }
  | { ok: false; reason: string };

// Scheme *allowlist*, deliberately not a blocklist of javascript:/data:/file:/
// blob:/vbscript:. A blocklist silently fails open the moment a browser ships a
// new scheme; an allowlist fails closed by construction.
const ALLOWED_PROTOCOLS = ["http:", "https:"];

export function validateDestinationUrl(raw: unknown): UrlCheck {
  if (typeof raw !== "string") return { ok: false, reason: "Destination is required." };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Destination is required." };
  if (trimmed.length > MAX_URL_CHARS) {
    return { ok: false, reason: `Destination must be under ${MAX_URL_CHARS} characters.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Enter a full URL, including https://" };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { ok: false, reason: "Only http:// and https:// destinations are allowed." };
  }
  if (!parsed.hostname) {
    return { ok: false, reason: "That URL has no domain." };
  }

  return { ok: true, url: parsed.toString() };
}

// Codes are short, human-typeable and printed on physical product: uppercase
// alphanumerics plus internal hyphens. Normalizing on both write and read means
// a guest's phone lowercasing the path still resolves.
const CODE_RE = new RegExp(`^[A-Z0-9][A-Z0-9-]{0,${MAX_CODE_CHARS - 1}}$`);

export function normalizeQrCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  if (!CODE_RE.test(v)) return null;
  if (v.endsWith("-")) return null;
  return v;
}

export function sanitizeLabel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Drop C0/C1 control characters by code point rather than by regex literal,
  // then collapse whitespace. Same end result as review/validation.ts's
  // sanitizeText, without embedding raw control bytes in the source.
  const stripped = Array.from(raw)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return !(c <= 0x1f || (c >= 0x7f && c <= 0x9f));
    })
    .join("");
  return stripped.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_CHARS);
}

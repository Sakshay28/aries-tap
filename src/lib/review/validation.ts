// Server-side validation + sanitization. The client validates for UX; this is
// the line that actually matters, because a Server Action is reachable by a raw
// POST that never touched our form. Dependency-free by design (the codebase's
// house style) — small, explicit, and easy to unit-test.

import {
  ALLOWED_IMAGE_TYPES,
  MAX_FEEDBACK_CHARS,
  MAX_NAME_CHARS,
  MAX_STORED_BYTES,
  MAX_TABLE_CHARS,
  type AllowedImageType,
} from "./config";
import type { Rating } from "./types";

// —————————————————————————————— text

// Strip control characters (except newline/tab), collapse runaway whitespace,
// trim, and hard-cap. React escapes on render so this isn't our XSS defense —
// it's hygiene so stored data is clean and bounded.
export function sanitizeText(raw: unknown, maxChars: number): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    // Drop control chars but keep \n (\x0A) and \t (\x09).
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return cleaned.slice(0, maxChars);
}

export function sanitizeFeedback(raw: unknown): string {
  return sanitizeText(raw, MAX_FEEDBACK_CHARS);
}

export function sanitizeName(raw: unknown): string {
  return sanitizeText(raw, MAX_NAME_CHARS).replace(/\n/g, " ");
}

export function sanitizeTable(raw: unknown): string {
  return sanitizeText(raw, MAX_TABLE_CHARS)
    .replace(/[^A-Za-z0-9 \-_.]/g, "")
    .trim();
}

export function isRating(n: unknown): n is Rating {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

// —————————————————————————————— contact

// Permissive, non-authoritative email check: reject the obviously-bogus, accept
// the rest. We never send to it automatically, so a false positive costs nothing.
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().toLowerCase().slice(0, 254);
  if (!v) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : "";
}

// Keep the digits and a leading +. Enough to be callable; not locale-strict,
// because a guest's phone may be from anywhere.
export function normalizePhone(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.replace(/[^\d+]/g, "").slice(0, 20);
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? v : "";
}

// —————————————————————————————— images

export type ImageCheck =
  | { ok: true; bytes: number; type: AllowedImageType }
  | { ok: false; reason: string };

// Magic-number sniff — trust the bytes, not the declared MIME. Prevents a
// script from smuggling a non-image (or a wrong-type) blob past a data: URL
// header. Also enforces the post-compression size ceiling.
export function validateImageDataUrl(dataUrl: unknown): ImageCheck {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return { ok: false, reason: "Not a data URL." };
  }
  // [\s\S] rather than the `s` (dotAll) flag — the base64 body can contain
  // newlines, and we target ES2017 where the flag isn't available.
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return { ok: false, reason: "Malformed image data." };

  const declared = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(declared as AllowedImageType)) {
    return { ok: false, reason: "Unsupported image type." };
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(match[2]);
  } catch {
    return { ok: false, reason: "Corrupt image data." };
  }

  if (bytes.length === 0) return { ok: false, reason: "Empty image." };
  if (bytes.length > MAX_STORED_BYTES) {
    return { ok: false, reason: "Image too large after compression." };
  }

  const sniffed = sniffImageType(bytes);
  if (!sniffed) return { ok: false, reason: "Not a recognizable image." };
  // The declared type must match the actual bytes — no PNG-labelled JPEG, etc.
  if (sniffed !== declared) {
    return { ok: false, reason: "Image type mismatch." };
  }

  return { ok: true, bytes: bytes.length, type: sniffed };
}

// Returns the real image type from the leading bytes, or null.
function sniffImageType(b: Uint8Array): AllowedImageType | null {
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF" ???? "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

// Base64 → bytes, runtime-agnostic (Buffer on Node, atob elsewhere).
function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

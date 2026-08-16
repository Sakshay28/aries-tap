// Image persistence for private feedback. The photos are already validated and
// compressed by the time they arrive here; this layer decides *where the bytes
// live*.
//
// Production shape (env-gated): each image is virus-scanned, then uploaded to a
// private bucket under a random UUID filename, and we store only the returned
// (signed) URL — never the raw bytes, never a guessable path. When no bucket is
// configured (dev, or a venue without object storage) we fall back to keeping
// the validated data: URL inline, so the feature works end-to-end with zero
// infra. Both hooks are plain authenticated fetches — no SDK, matching the
// codebase's integration style (see wifi/delivery.ts).

import { MAX_IMAGES, type AllowedImageType } from "./config";
import { validateImageDataUrl } from "./validation";

const UPLOAD_URL = process.env.REVIEW_UPLOAD_WEBHOOK_URL;
const UPLOAD_TOKEN = process.env.REVIEW_UPLOAD_TOKEN;
const SCAN_URL = process.env.REVIEW_VIRUS_SCAN_URL;

export const usingRealStorage = Boolean(UPLOAD_URL && UPLOAD_TOKEN);

export type PersistResult = { urls: string[]; rejected: number };

// Validate, (optionally) scan, and persist up to MAX_IMAGES photos. Anything
// that fails validation or scanning is dropped, not fatal — a bad photo must
// never sink an otherwise-valid complaint.
export async function persistImages(images: unknown): Promise<PersistResult> {
  if (!Array.isArray(images) || images.length === 0) return { urls: [], rejected: 0 };

  const urls: string[] = [];
  let rejected = 0;

  for (const raw of images.slice(0, MAX_IMAGES)) {
    const check = validateImageDataUrl(raw);
    if (!check.ok) {
      rejected++;
      continue;
    }
    const dataUrl = raw as string;

    if (!(await isClean(dataUrl))) {
      rejected++;
      continue;
    }

    try {
      const url = usingRealStorage
        ? await upload(dataUrl, check.type)
        : dataUrl; // fallback: keep the validated data URL inline
      urls.push(url);
    } catch (err) {
      console.error("[review-storage] upload failed", err);
      rejected++;
    }
  }

  // Count any over-limit extras as rejected so the caller can tell the guest.
  if (Array.isArray(images) && images.length > MAX_IMAGES) {
    rejected += images.length - MAX_IMAGES;
  }

  return { urls, rejected };
}

// —————————————————————————————— virus scan hook

// Optional external scanner. Returns true (clean) when unconfigured so the flow
// still works; a real deployment points this at ClamAV/an AV gateway.
async function isClean(dataUrl: string): Promise<boolean> {
  if (!SCAN_URL) return true;
  try {
    const res = await fetch(SCAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { clean?: boolean };
    return data.clean === true;
  } catch {
    // Fail closed: if the scanner is configured but unreachable, don't store.
    return false;
  }
}

// —————————————————————————————— uploader hook

async function upload(dataUrl: string, type: AllowedImageType): Promise<string> {
  const filename = `${crypto.randomUUID()}.${extFor(type)}`;
  const res = await fetch(UPLOAD_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPLOAD_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ filename, contentType: type, data: dataUrl }),
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  const out = (await res.json()) as { url?: string };
  if (!out.url) throw new Error("uploader returned no url");
  return out.url;
}

function extFor(type: AllowedImageType): string {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

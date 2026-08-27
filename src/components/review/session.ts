// Client-side identity for a review. Two ids, on purpose:
//   • deviceId  — persistent (localStorage). Powers rate-limiting, duplicate
//                 detection and repeat-visitor stats. A random UUID, never PII.
//   • sessionId — one per opening of the modal. Ties every funnel event of a
//                 single visit together.
// Plus the table/seat from the NFC/QR deep link (?t=12), so a complaint can be
// pinned to exactly where it happened without asking the guest anything.

import { clientTable } from "@/lib/table/session";

const DEVICE_KEY = "aries_review_device";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers — good enough for an opaque id.
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = uuid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked — fall back to an ephemeral id.
    return uuid();
  }
}

export function newSessionId(): string {
  return uuid();
}

// Read the table/seat from common deep-link params. Bounded + sanitized again
// server-side; this is just for a nicer default.
export function getTable(): string {
  if (typeof window === "undefined") return "";
  try {
    const p = new URLSearchParams(window.location.search);
    const raw = p.get("t") || p.get("table") || p.get("seat") || "";
    const fromUrl = raw.replace(/[^A-Za-z0-9 \-_.]/g, "").slice(0, 24);
    // Otherwise the table stamped on this visit when the guest scanned their
    // tent's tag. The guest is never asked; the tag already said which table.
    return fromUrl || clientTable();
  } catch {
    return "";
  }
}

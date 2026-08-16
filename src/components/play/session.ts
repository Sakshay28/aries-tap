// Client-side identity for a play session, mirroring the Review flow's shape:
//   • deviceId  — persistent (localStorage). Powers the per-device cooldown,
//                 the daily "one play" gate, and repeat-visitor stats. A random
//                 UUID, never PII.
//   • sessionId — one per opening of Play & Win. Ties a visit's steps together.
// Plus the table/seat from the NFC/QR deep link (?t=12), pinned to every play.

const DEVICE_KEY = "aries_play_device";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
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
    return uuid();
  }
}

export function newSessionId(): string {
  return uuid();
}

export function getTable(): string {
  if (typeof window === "undefined") return "";
  try {
    const p = new URLSearchParams(window.location.search);
    const raw = p.get("t") || p.get("table") || p.get("seat") || "";
    return raw.replace(/[^A-Za-z0-9 \-_.]/g, "").slice(0, 24);
  } catch {
    return "";
  }
}

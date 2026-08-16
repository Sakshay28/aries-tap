// Derive coarse device/geo context from request headers. Runs server-side in
// the review actions. Deliberately low-resolution: enough to spot "every 1★ is
// from table 12 on a Friday", never enough to identify a person.

import type { ClientContext } from "./types";
import { sha256Hex } from "@/lib/wifi/session";

// Tiny User-Agent classifier. Not exhaustive — the long tail folds into
// "Other" rather than pretending to precision we don't have.
function parseUserAgent(ua: string): Pick<ClientContext, "device" | "browser" | "os"> {
  const s = ua || "";

  // OS first — it disambiguates several browsers below.
  let os = "Other";
  if (/iPhone|iPad|iPod/.test(s)) os = "iOS";
  else if (/Android/.test(s)) os = "Android";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/Windows/.test(s)) os = "Windows";
  else if (/Linux/.test(s)) os = "Linux";

  let device = "Desktop";
  if (/iPhone/.test(s)) device = "iPhone";
  else if (/iPad/.test(s)) device = "iPad";
  else if (/Android/.test(s)) device = /Mobile/.test(s) ? "Android phone" : "Android tablet";
  else if (os === "macOS") device = "Mac";
  else if (os === "Windows") device = "Windows PC";

  // Order matters: Edge/Chrome/Safari all lie about each other in the UA.
  let browser = "Other";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = "Chrome";
  else if (/CriOS/.test(s)) browser = "Chrome";
  else if (/Firefox\/|FxiOS/.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s)) browser = "Safari";

  return { device, browser, os };
}

// Vercel injects geo headers at the edge; other hosts may not. Absent → "".
function parseGeo(headers: Headers): Pick<ClientContext, "country" | "city"> {
  const country =
    headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || "";
  const cityRaw = headers.get("x-vercel-ip-city") || "";
  // Vercel URL-encodes city names ("New%20Delhi").
  let city = "";
  try {
    city = decodeURIComponent(cityRaw);
  } catch {
    city = cityRaw;
  }
  return { country: country.toUpperCase().slice(0, 2), city: city.slice(0, 80) };
}

export function clientContext(headers: Headers): ClientContext {
  const ua = headers.get("user-agent") || "";
  return { ...parseUserAgent(ua), ...parseGeo(headers) };
}

// Best-effort client IP behind proxies — same logic as the WiFi flow.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

// We never store a raw IP. A salted hash lets us rate-limit and spot repeat
// abuse without keeping the address itself.
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.WIFI_SESSION_SECRET || "dev-insecure-session-secret";
  return (await sha256Hex(`${salt}:${ip}`)).slice(0, 32);
}

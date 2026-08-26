"use client";

// A one-shot beacon that records a PROFILE_VIEW when the landing page opens, so
// "someone opened the page" joins the same live stream as taps and reviews.
//
// It reuses the anonymous per-visit id set by the NFC resolver (the `aries_sid`
// cookie), so a view is tied to the tap that led here — and mints one for a
// direct visit so a later WhatsApp click still correlates. Fire-and-forget with
// `keepalive`, guarded to run once per tab so a remount (or React Strict Mode's
// double-invoke in dev) can't double-count.

import { useEffect } from "react";
import { ANON_COOKIE, newAnonId } from "@/lib/events/session";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function ensureAnonId(): string {
  const existing = readCookie(ANON_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{6,64}$/.test(existing)) return existing;
  const id = newAnonId();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ANON_COOKIE}=${id}; Max-Age=${60 * 30}; Path=/; SameSite=Lax${secure}`;
  return id;
}

export function TapBeacon({ tagCode }: { tagCode?: string }) {
  useEffect(() => {
    const KEY = "aries_pv_sent";
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode: fall through, worst case one extra view */
    }
    const sessionId = ensureAnonId();
    try {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PROFILE_VIEW",
          sessionId,
          tagCode: tagCode ?? null,
          source: "client",
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* telemetry only — never surface to the guest */
    }
  }, [tagCode]);

  return null;
}

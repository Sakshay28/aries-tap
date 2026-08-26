// An opaque, anonymous per-visit id so a tap can be correlated with what the
// same guest does next (open the page, click WhatsApp) — enough to measure a
// conversion funnel, never enough to identify a person. It is a random token in
// a short-lived cookie: no PII, no device fingerprint, expires within the visit.
//
// Set server-side by the NFC resolver and readable by the landing page's beacon
// and the WhatsApp redirect, so all three attribute to the same visit.

import type { NextRequest, NextResponse } from "next/server";

export const ANON_COOKIE = "aries_sid";
export const ANON_TTL_SECONDS = 60 * 30; // one sitting

export function newAnonId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

const VALID = /^[A-Za-z0-9_-]{6,64}$/;

export function readAnonId(req: NextRequest): string | null {
  const v = req.cookies.get(ANON_COOKIE)?.value;
  return v && VALID.test(v) ? v : null;
}

export function setAnonCookie(res: NextResponse, id: string): void {
  res.cookies.set(ANON_COOKIE, id, {
    httpOnly: false, // the landing beacon reads it to tag client events
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANON_TTL_SECONDS,
  });
}

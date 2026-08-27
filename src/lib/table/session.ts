// Which table a guest is sitting at — established silently, never asked.
//
// The table is carried by the QR itself: every tent has its own code, so
// scanning ariestap.in/q/T12 IS the guest telling us they're at table 12. The
// resolver stamps that onto the visit as a cookie, and every flow the guest
// touches afterwards — WiFi, review, complaint — reads it server-side.
//
// Cookie rather than a URL parameter, because a URL parameter survives exactly
// one navigation. A guest scans at the table, taps through to the WiFi page,
// joins, wanders to the review flow twenty minutes later; only a cookie is
// still there at the end of that journey. The `?t=` parameter is still set on
// the redirect as a same-page hint, but the cookie is what actually holds.
//
// Server-trusted: it is written only by the resolver, from a database row it
// just looked up. A client can forge the cookie, but the blast radius is a
// guest mislabelling their own table on their own complaint — worth far less
// than the friction of asking 40 tables' worth of guests a question.

import type { NextResponse } from "next/server";

export const TABLE_COOKIE = "aries_table";

// A visit, not a session: long enough to cover a long meal, short enough that
// tomorrow's guest on the same phone isn't filed under tonight's table.
export const TABLE_TTL_SECONDS = 4 * 60 * 60;

/** The one normalization rule, shared by every reader and writer. */
export function normalizeTable(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[^A-Za-z0-9 \-_.]/g, "")
    .trim()
    .slice(0, 12)
    .toUpperCase();
}

/** Stamp the visit with the table the scanned tag belongs to. */
export function setTableCookie(res: NextResponse, table: string): void {
  const v = normalizeTable(table);
  if (!v) return;
  res.cookies.set(TABLE_COOKIE, v, {
    // Readable by client code too — the review beacon attaches it to funnel
    // events without a server round-trip. It is a table number, not a secret.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TABLE_TTL_SECONDS,
  });
}

/** Read the visit's table from a request's cookies (server-side). */
export function tableFromRequest(req: { cookies: { get(n: string): { value: string } | undefined } }): string {
  return normalizeTable(req.cookies.get(TABLE_COOKIE)?.value);
}

/** Read the visit's table in the browser. Empty when the guest never scanned. */
export function clientTable(): string {
  if (typeof document === "undefined") return "";
  try {
    const m = document.cookie.match(/(?:^|;\s*)aries_table=([^;]*)/);
    return m ? normalizeTable(decodeURIComponent(m[1])) : "";
  } catch {
    return "";
  }
}

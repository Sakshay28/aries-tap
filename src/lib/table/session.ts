// Which table is this guest sitting at?
//
// With one universal QR across the whole venue, the printed code cannot say
// where the guest is — every tent carries the same URL. So the guest tells us
// once, and we remember it for the rest of the visit.
//
// "Once" is the important part. A manager wants table numbers on complaints and
// WiFi sign-ups, but a guest asked their table number three times in one visit
// simply stops answering. The answer is cached for VISIT_TTL_MS and shared by
// every flow, so a guest who joins the WiFi and later leaves a review is asked
// exactly one time.
//
// A `?t=5A` deep link still wins when present (per-table codes, table-specific
// links) — this is the fallback for when the URL cannot tell us.

const KEY = "aries_table";

// Long enough to cover a meal, short enough that tomorrow's guest at the same
// device isn't silently filed under yesterday's table.
const VISIT_TTL_MS = 4 * 60 * 60 * 1000;

type Stored = { value: string; at: number };

/** Trim to what a table label can legitimately be. Mirrors the server rule. */
export function normalizeTable(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9 \-_.]/g, "")
    .trim()
    .slice(0, 12)
    .toUpperCase();
}

/** The table from the URL, if the link carried one. Highest priority. */
export function tableFromUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const p = new URLSearchParams(window.location.search);
    return normalizeTable(p.get("t") || p.get("table") || p.get("seat") || "");
  } catch {
    return "";
  }
}

/** The remembered answer for this visit, if it hasn't gone stale. */
export function storedTable(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as Stored;
    if (!s?.value || typeof s.at !== "number") return "";
    if (Date.now() - s.at > VISIT_TTL_MS) return "";
    return normalizeTable(s.value);
  } catch {
    return "";
  }
}

export function rememberTable(value: string): void {
  const v = normalizeTable(value);
  if (!v || typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ value: v, at: Date.now() } satisfies Stored));
  } catch {
    /* private mode — the guest just gets asked again next flow */
  }
}

/** URL first, then this visit's remembered answer. Empty = we must ask. */
export function currentTable(): string {
  return tableFromUrl() || storedTable();
}

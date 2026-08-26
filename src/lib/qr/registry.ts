// The printed-code registry — the safety net under every physical Aries Tap.
//
// A printed QR is the one artifact in this system we cannot fix after the fact.
// Once it is on a table tent, a coaster or a menu card, its URL is frozen
// forever. That makes "the database row is missing" an unacceptable failure
// mode: an empty database, an unseeded environment, a Neon outage or a
// forgotten DATABASE_URL would all turn a customer's physical product into a
// dead 404.
//
// So every code that has been *physically printed* is also declared here, in
// code, and ships with the deployment itself. Resolution order:
//
//     1. database row   — the live, dashboard-editable destination
//     2. this registry  — the destination the code was printed against
//     3. 404            — genuinely unknown code, never printed
//
// The database still wins whenever it has an answer, so the dashboard keeps
// full dynamic control. This file only decides what happens when the database
// has nothing to say — and the answer is "send the guest somewhere sensible",
// never "show them an error".
//
// Adding a code here is a deliberate act that should accompany a print run.

export type PrintedCode = {
  code: string;
  /**
   * Where this code points when the database has no row for it. Use a durable
   * destination — a homepage or lobby, not a seasonal offer that will rot.
   */
  fallbackUrl: string;
  label: string;
  /** ISO date of the print run, for reprint/audit traceability. */
  printedOn: string;
};

export const PRINTED_CODES: PrintedCode[] = [
  {
    code: "AT001",
    fallbackUrl: "https://aries-tap.vercel.app/",
    label: "AT001 — first print run",
    printedOn: "2026-08-26",
  },
];

const INDEX = new Map(PRINTED_CODES.map((c) => [c.code, c]));

export function printedCode(code: string): PrintedCode | null {
  return INDEX.get(code) ?? null;
}

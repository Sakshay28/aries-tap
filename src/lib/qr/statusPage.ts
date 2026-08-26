// Branded HTML for the two non-redirecting resolver outcomes. A Route Handler
// can't render React or export `metadata`, so this is a small self-contained
// document using the live design tokens — the guest never sees a raw framework
// error page, and never sees anything about the database.

import { business } from "@/lib/content";

function page(opts: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${opts.title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100svh; display: flex; align-items: center;
    justify-content: center; padding: 2rem 1.25rem;
    background: #0b0b0a; color: #f4f1ea;
    font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 100%; max-width: 24rem; text-align: center;
    border: 1px solid rgba(244,241,234,0.08); border-radius: 1.5rem;
    padding: 2.5rem 1.75rem; background: rgba(244,241,234,0.04);
  }
  .mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2.75rem; height: 2.75rem; border-radius: 0.9rem; margin-bottom: 1.25rem;
    background: rgba(200,167,110,0.14); color: #c8a76e;
    font-weight: 600; font-size: 1.05rem; letter-spacing: 0.02em;
  }
  h1 { margin: 0 0 0.6rem; font-size: 1.2rem; font-weight: 600; letter-spacing: -0.02em; }
  p { margin: 0; font-size: 0.9rem; color: rgba(244,241,234,0.6); }
  .venue {
    margin-top: 1.75rem; padding-top: 1.25rem;
    border-top: 1px solid rgba(244,241,234,0.08);
    font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(244,241,234,0.3);
  }
</style>
</head>
<body>
  <main class="card">
    <span class="mark" aria-hidden="true">AT</span>
    ${opts.body}
    <div class="venue">Aries Tap</div>
  </main>
</body>
</html>`;
}

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  // Never let a paused-then-resumed code serve a cached "inactive" page. A bare
  // 200 is the one status browsers and CDNs cache heuristically by default.
  "Cache-Control": "no-store, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow",
};

// Deliberately 200, not an error status: this is successfully-served
// informational content for a guest, not a broken request.
export function inactiveResponse(): Response {
  return new Response(
    page({
      title: "Currently inactive · Aries Tap",
      body: `<h1>This Aries Tap is currently inactive.</h1>
      <p>Please contact ${business.name} for assistance.</p>`,
    }),
    { status: 200, headers: HEADERS },
  );
}

export function notFoundResponse(): Response {
  return new Response(
    page({
      title: "Not found · Aries Tap",
      body: `<h1>We couldn't find this Aries Tap.</h1>
      <p>Please check the code and try scanning again.</p>`,
    }),
    { status: 404, headers: HEADERS },
  );
}

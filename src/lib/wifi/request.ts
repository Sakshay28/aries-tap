// Request-level helpers shared by the route handlers: client IP (for
// rate-limiting) and Cloudflare Turnstile verification (bot defence on the
// phone step). Turnstile is optional — if no secret is configured it's a
// no-op, so dev and pre-launch environments work without it.

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

export const turnstileEnabled = Boolean(TURNSTILE_SECRET);

// Best-effort client IP behind Vercel/proxies. Falls back to a constant so a
// missing header degrades to a shared bucket rather than throwing.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

export async function verifyTurnstile(
  token: string | undefined,
  ip: string
): Promise<boolean> {
  if (!turnstileEnabled) return true; // disabled → allow
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
        cache: "no-store",
      }
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

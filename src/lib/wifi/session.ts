// Signed, tamper-proof tokens for httpOnly cookies — used for the "this phone
// is verified" proof and the admin login. HMAC-SHA256 via Web Crypto, so no
// dependency and it runs on any runtime. A token is `base64url(payload).sig`.

const encoder = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToString(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

function secret(): string {
  // In dev we fall back to a fixed key so tokens survive restarts; production
  // must set WIFI_SESSION_SECRET (checked at go-live, see .env.example).
  return process.env.WIFI_SESSION_SECRET || "dev-insecure-session-secret";
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

type Payload = Record<string, unknown> & { exp: number };

export async function signToken(
  data: Record<string, unknown>,
  ttlSeconds: number
): Promise<string> {
  const payload: Payload = { ...data, exp: Date.now() + ttlSeconds * 1000 };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(), encoder.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken<T = Record<string, unknown>>(
  token: string | undefined
): Promise<T | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    // crypto.subtle.verify does the constant-time HMAC comparison for us.
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(),
      Uint8Array.from(b64urlToString(sig), (c) => c.charCodeAt(0)),
      encoder.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(b64urlToString(body)) as Payload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload as T;
  } catch {
    return null;
  }
}

// SHA-256 hex — used to store OTPs and IPs without keeping the raw value.
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

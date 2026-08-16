// Ephemeral key/value store for OTPs and rate-limit counters.
//
// Production: Upstash Redis over its REST API — reached with plain `fetch`, so
// there is no SDK dependency and it runs on any serverless runtime.
// Dev fallback: an in-memory Map with TTLs, so the whole flow works locally
// with no external service. (The fallback is per-process, which is exactly
// right for a single dev server and never used in production.)

type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
  ttl(key: string): Promise<number>;
};

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const usingRealStore = Boolean(REST_URL && REST_TOKEN);

// ————————————————————————————————— Upstash

async function redis<T = unknown>(command: (string | number)[]): Promise<T> {
  const res = await fetch(REST_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { result: T; error?: string };
  if (data.error) throw new Error(`Upstash: ${data.error}`);
  return data.result;
}

const upstash: Store = {
  async get(key) {
    return redis<string | null>(["GET", key]);
  },
  async set(key, value, ttlSeconds) {
    await redis(["SET", key, value, "EX", ttlSeconds]);
  },
  async incrWithTtl(key, ttlSeconds) {
    const count = await redis<number>(["INCR", key]);
    // EXPIRE ... NX only sets a TTL when none exists, so the window expires
    // ttlSeconds after the *first* hit rather than sliding on every request.
    await redis(["EXPIRE", key, ttlSeconds, "NX"]);
    return count;
  },
  async del(key) {
    await redis(["DEL", key]);
  },
  async ttl(key) {
    return redis<number>(["TTL", key]);
  },
};

// ————————————————————————————————— In-memory fallback

const mem = new Map<string, { value: string; expiresAt: number }>();

function memGetRaw(key: string): { value: string; expiresAt: number } | null {
  const entry = mem.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    mem.delete(key);
    return null;
  }
  return entry;
}

const memory: Store = {
  async get(key) {
    return memGetRaw(key)?.value ?? null;
  },
  async set(key, value, ttlSeconds) {
    mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async incrWithTtl(key, ttlSeconds) {
    const existing = memGetRaw(key);
    const next = existing ? String(Number(existing.value) + 1) : "1";
    const expiresAt = existing
      ? existing.expiresAt
      : Date.now() + ttlSeconds * 1000;
    mem.set(key, { value: next, expiresAt });
    return Number(next);
  },
  async del(key) {
    mem.delete(key);
  },
  async ttl(key) {
    const entry = memGetRaw(key);
    if (!entry) return -2;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  },
};

export const store: Store = usingRealStore ? upstash : memory;

// The venues the owner dashboard aggregates. On a shared multi-venue database
// each of these tenant ids already scopes its own rows (taps, leads, reviews,
// chats), so the dashboard just asks each store for one tenant at a time.
//
// Default is the three current deployments; override with ARIES_OWNER_VENUES, a
// JSON array like [{"id":"taffeta","name":"Taffeta"}], so adding a venue is a
// config change, not a code change.

export type Venue = { id: string; name: string };

const DEFAULT_VENUES: Venue[] = [
  { id: "taffeta", name: "Taffeta" },
  { id: "magnolia", name: "Magnolia" },
  { id: "lazymojo", name: "LazyMojo" },
];

function parseEnv(): Venue[] | null {
  const raw = process.env.ARIES_OWNER_VENUES;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const venues = parsed
      .map((v) => v as Partial<Venue>)
      .filter((v): v is Venue => typeof v.id === "string" && typeof v.name === "string");
    return venues.length ? venues : null;
  } catch {
    return null;
  }
}

export const VENUES: Venue[] = parseEnv() ?? DEFAULT_VENUES;

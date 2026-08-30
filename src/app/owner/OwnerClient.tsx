"use client";

// The owner's cross-venue dashboard — the single-venue phone screen, stacked
// once per venue. Same four boxes, same drill-downs (reused verbatim from the
// single-venue dashboard so the design can never drift), behind the owner login.
// Every venue's numbers are read tenant-scoped server-side; the client just
// renders bundles and opens a full-screen detail when a box is tapped.

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Lock, RefreshCw } from "lucide-react";
import {
  MetricGrid,
  Detail,
  type Counts,
  type Tile,
  type Overview,
  type WifiData,
  type ReviewAnalytics,
  type Feedback,
  type ChatData,
} from "@/app/admin/overview/OverviewClient";
import logoTaffeta from "@/images/logo-taffeta.png";
import logoMagnolia from "@/images/logo-magnolia.png";
import logoLazymojo from "@/images/logo-lazymojo.png";

// Each venue is shown by its brand mark, not its name. Keyed by tenant id; a
// venue with no logo here falls back to its name (see VenueMark).
const VENUE_LOGOS: Record<string, { src: string }> = {
  taffeta: logoTaffeta,
  magnolia: logoMagnolia,
  lazymojo: logoLazymojo,
};

// The venue's logo on a clean white chip so a transparent, dark-ink mark reads
// in both light and dark themes. `size` is the logo height in px.
function VenueMark({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const logo = VENUE_LOGOS[id];
  if (!logo)
    return <span className="text-[18px] font-semibold tracking-[-0.01em]">{name}</span>;
  return (
    <span className="inline-flex items-center rounded-2xl bg-white px-4 py-2 shadow-[var(--od-elev)] ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt={name}
        style={{ height: size, width: "auto" }}
        className="max-w-[190px] object-contain"
      />
    </span>
  );
}

type VenueBundle = {
  venue: { id: string; name: string };
  overview: Overview;
  wifi: WifiData;
  analytics: ReviewAnalytics;
  feedback: Feedback[];
  chat: ChatData;
};

function countsOf(b: VenueBundle): Counts {
  return {
    taps: b.overview.totalTaps,
    tapsToday: b.overview.tapsToday,
    wifiTotal: b.wifi.stats.total,
    wifiToday: b.wifi.stats.today,
    reviewTotal: b.analytics.totalRatings,
    avg: b.analytics.averageRating,
    chatTotal: b.chat.stats.total,
    chatToday: b.chat.stats.today,
  };
}

export function OwnerClient() {
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [venues, setVenues] = useState<VenueBundle[]>([]);
  const [selected, setSelected] = useState<{ venueId: string; tile: Tile } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/owner/overview", { cache: "no-store" });
    if (r.status === 401) {
      setPhase("login");
      return;
    }
    if (!r.ok) throw new Error("owner overview");
    const data = (await r.json()) as { venues: VenueBundle[] };
    setVenues(data.venues);
    setPhase("ready");
  }, []);

  useEffect(() => {
    load().catch(() => setPhase("error"));
  }, [load]);

  // Near-real-time without three SSE streams: a light poll while the grid is up.
  useEffect(() => {
    if (phase !== "ready") return;
    const poll = setInterval(() => load().catch(() => {}), 15_000);
    return () => clearInterval(poll);
  }, [phase, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setLoginError(res.status === 401 ? "That password didn't work." : "Login unavailable.");
        return;
      }
      setPassword("");
      setPhase("loading");
      await load();
    } catch {
      setLoginError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "login")
    return (
      <OwnerLogin
        password={password}
        setPassword={setPassword}
        onSubmit={login}
        busy={busy}
        error={loginError}
      />
    );
  if (phase === "loading")
    return (
      <div className="od-root flex min-h-svh items-center justify-center">
        <Loader2 size={26} className="spin text-[color:var(--od-ink-3)]" aria-hidden />
      </div>
    );
  if (phase === "error")
    return (
      <div className="od-root flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--od-tap-bg)] text-[color:var(--od-tap)]">
          <AlertCircle size={22} aria-hidden />
        </span>
        <p className="mt-3 text-[16px] font-semibold">Couldn&apos;t load your venues</p>
        <button
          type="button"
          onClick={() => (setPhase("loading"), load().catch(() => setPhase("error")))}
          className="od-btn od-btn-primary mt-5 w-full max-w-xs"
        >
          <RefreshCw size={16} aria-hidden /> Try again
        </button>
      </div>
    );

  // A box is open → the venue's full-screen detail (reused from the single view).
  if (selected) {
    const b = venues.find((v) => v.venue.id === selected.venueId);
    if (b) {
      return (
        <div className="od-root min-h-svh">
          <div className="mx-auto w-full max-w-md px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="mb-3">
              <VenueMark id={b.venue.id} name={b.venue.name} size={22} />
            </div>
            <Detail
              tile={selected.tile}
              onBack={() => setSelected(null)}
              overview={b.overview}
              wifi={b.wifi}
              analytics={b.analytics}
              feedback={b.feedback}
              chat={b.chat}
            />
          </div>
        </div>
      );
    }
  }

  // The stacked grid: every venue's four boxes.
  return (
    <div className="od-root min-h-svh">
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.03em]">
              Command Center
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[color:var(--od-ink-2)]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "var(--od-live)" }}
                aria-hidden
              />
              {venues.length} {venues.length === 1 ? "venue" : "venues"} · Live
            </p>
          </div>
          <button
            type="button"
            onClick={() => load().catch(() => {})}
            aria-label="Refresh"
            className="od-press flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--od-surface)] shadow-[var(--od-elev)]"
          >
            <RefreshCw size={18} className="text-[color:var(--od-ink-2)]" aria-hidden />
          </button>
        </header>

        <div className="mt-6 flex flex-col gap-7">
          {venues.map((b) => (
            <section key={b.venue.id}>
              <div className="mb-3.5">
                <VenueMark id={b.venue.id} name={b.venue.name} size={30} />
              </div>
              <MetricGrid
                counts={countsOf(b)}
                onOpen={(tile) => setSelected({ venueId: b.venue.id, tile })}
              />
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-[12px] text-[color:var(--od-ink-3)]">
          Tap any box for details · Aries Tap
        </p>
      </div>
    </div>
  );
}

function OwnerLogin({
  password,
  setPassword,
  onSubmit,
  busy,
  error,
}: {
  password: string;
  setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  error: string;
}) {
  return (
    <div className="od-root flex min-h-svh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--od-espresso)] text-[22px] font-semibold text-[color:var(--od-bg)]">
            A
          </span>
          <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.02em]">Owner dashboard</h1>
          <p className="mt-1 text-[14px] text-[color:var(--od-ink-2)]">All your venues, one login</p>
        </div>

        <form onSubmit={onSubmit} className="od-card mt-6 p-5">
          <label htmlFor="owner-pw" className="text-[13px] font-semibold text-[color:var(--od-ink-2)]">
            Owner password
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--od-border-2)] bg-[color:var(--od-surface-2)] px-3.5">
            <Lock size={16} className="text-[color:var(--od-ink-3)]" aria-hidden />
            <input
              id="owner-pw"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full bg-transparent text-[16px] outline-none placeholder:text-[color:var(--od-ink-3)]"
            />
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--od-tap)]">
              <AlertCircle size={14} aria-hidden /> {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="od-btn od-btn-primary mt-4 w-full disabled:opacity-60">
            {busy ? <Loader2 size={17} className="spin" aria-hidden /> : "Open dashboard"}
          </button>
        </form>
        <p className="mt-4 text-center text-[12px] text-[color:var(--od-ink-3)]">Aries Tap</p>
      </div>
    </div>
  );
}

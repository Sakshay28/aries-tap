"use client";

// The live owner dashboard — mobile-first. It loads a confirmed snapshot from
// the database (overview metrics + recent activity + review summary), then opens
// a Server-Sent Events stream and applies each new event incrementally: counters
// tick, the timeline grows, charts update — no page reload.
//
// The realtime/data layer here is unchanged from the verified build: same
// endpoints, same SSE stream with cursor resync, same reconcile-on-review rule
// (spec §24: the DB is the source of truth; simple counts bump live, derived
// numbers are re-fetched on a short debounce and on every reconnect/refresh).
// Everything below the state/handlers is presentation.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  Eye,
  Gamepad2,
  Home,
  Inbox,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  MousePointerClick,
  Nfc,
  QrCode,
  RefreshCw,
  Share2,
  Star,
  Tag,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { business } from "@/lib/content";
import type { OverviewMetrics, TapEvent, TapEventType } from "@/lib/events/types";

// —————————————————————————————— event presentation

type Tone = "tap" | "wa" | "review" | "view" | "cta";

const EVENT_META: Record<TapEventType, { label: string; Icon: LucideIcon; tone: Tone }> = {
  NFC_TAP: { label: "NFC tap", Icon: Nfc, tone: "tap" },
  WHATSAPP_CLICK: { label: "WhatsApp clicked", Icon: MessageCircle, tone: "wa" },
  PROFILE_VIEW: { label: "Page viewed", Icon: Eye, tone: "view" },
  CTA_CLICK: { label: "Button tapped", Icon: MousePointerClick, tone: "cta" },
  REVIEW_STARTED: { label: "Review opened", Icon: Star, tone: "review" },
  REVIEW_RECEIVED: { label: "New rating", Icon: Star, tone: "review" },
  REVIEW_SUBMITTED: { label: "New feedback", Icon: Star, tone: "review" },
};

function toneStyle(tone: Tone): React.CSSProperties {
  return { color: `var(--od-${tone})`, background: `var(--od-${tone}-bg)` };
}

// —————————————————————————————— formatting helpers

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}
function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function relTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function cursorOf(e: TapEvent): string {
  return `${e.createdAt}|${e.id}`;
}
function eventDetail(e: TapEvent): string {
  const bits: string[] = [];
  if ((e.type === "REVIEW_RECEIVED" || e.type === "REVIEW_SUBMITTED") && e.rating) {
    bits.push(`${e.rating}★`);
  }
  if (e.tagCode) bits.push(e.tagCode);
  const place = [e.city, e.country].filter(Boolean).join(", ");
  if (place) bits.push(place);
  else if (e.device) bits.push(e.device);
  return bits.join(" · ");
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const FEED_CAP = 200;

type TabKey = "home" | "activity" | "reviews" | "tags" | "more";
const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "activity", label: "Activity", Icon: Activity },
  { key: "reviews", label: "Reviews", Icon: Star },
  { key: "tags", label: "Tags", Icon: Tag },
  { key: "more", label: "More", Icon: MoreHorizontal },
];

type ReviewData = {
  analytics: { averageRating: number; totalRatings: number; ratingCounts: Record<string, number> };
  feedback: { id: string; rating: number; feedback: string; createdAt: string; status: string; name: string }[];
};

// —————————————————————————————— component

export function OverviewClient() {
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [feed, setFeed] = useState<TapEvent[]>([]);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");
  const [filter, setFilter] = useState<TapEventType | "ALL">("ALL");
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<TabKey>("home");
  const [lastLiveId, setLastLiveId] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [announce, setAnnounce] = useState("");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | null>(null);
  const reconcileRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<() => void>(() => {});

  // ——— reviews summary (existing admin endpoint; reused, not duplicated) ———
  const loadReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/review/admin", { cache: "no-store" });
      if (res.ok) setReviews((await res.json()) as ReviewData);
    } catch {
      /* non-fatal — the dashboard works without the review detail */
    }
  }, []);

  // ——— reconcile derived metrics from the server (debounced) ———
  const reconcile = useCallback(() => {
    if (reconcileRef.current) clearTimeout(reconcileRef.current);
    reconcileRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
        if (res.ok) setMetrics((await res.json()) as OverviewMetrics);
      } catch {
        /* transient; next event or reconnect retries */
      }
      void loadReviews();
    }, 6000);
  }, [loadReviews]);

  // ——— apply one live event ———
  const applyEvent = useCallback(
    (e: TapEvent) => {
      if (!e || !e.id || seenRef.current.has(e.id)) return;
      seenRef.current.add(e.id);
      const cur = cursorOf(e);
      if (!cursorRef.current || cur > cursorRef.current) cursorRef.current = cur;

      setFeed((prev) => [e, ...prev].slice(0, FEED_CAP));
      setLastLiveId(e.id);
      setAnnounce(`${EVENT_META[e.type]?.label ?? "Event"}${e.tagCode ? ` on ${e.tagCode}` : ""}`);

      setMetrics((m) => {
        if (!m) return m;
        const today = utcDayKey(e.createdAt) === utcDayKey(new Date().toISOString());
        const n: OverviewMetrics = { ...m, totalEvents: m.totalEvents + 1 };
        if (e.type === "NFC_TAP") {
          n.totalTaps = m.totalTaps + 1;
          if (today) n.tapsToday = m.tapsToday + 1;
          n.taps14d = m.taps14d.map((p) =>
            p.date === utcDayKey(e.createdAt) ? { ...p, count: p.count + 1 } : p
          );
          if (e.tagCode) n.topTags = bumpTag(m.topTags, e, today);
        } else if (e.type === "WHATSAPP_CLICK") {
          n.whatsappClicks = m.whatsappClicks + 1;
          if (today) n.whatsappClicksToday = m.whatsappClicksToday + 1;
        } else if (e.type === "PROFILE_VIEW") {
          n.profileViews = m.profileViews + 1;
        }
        return n;
      });

      if (e.type === "REVIEW_RECEIVED" || e.type === "REVIEW_SUBMITTED" || e.type === "WHATSAPP_CLICK") {
        reconcile();
      }
    },
    [reconcile]
  );

  // ——— open the live stream ———
  const connect = useCallback(() => {
    esRef.current?.close();
    setConn("connecting");
    const qs = cursorRef.current ? `?cursor=${encodeURIComponent(cursorRef.current)}` : "";
    const es = new EventSource(`/api/dashboard/stream${qs}`);
    esRef.current = es;
    es.addEventListener("ready", () => setConn("live"));
    es.addEventListener("tap", (ev) => {
      try {
        applyEvent(JSON.parse((ev as MessageEvent).data) as TapEvent);
      } catch {
        /* ignore malformed frame */
      }
    });
    es.onopen = () => setConn("live");
    es.onerror = () => setConn(navigator.onLine === false ? "offline" : "reconnecting");
  }, [applyEvent]);

  // ——— initial + post-login load ———
  const load = useCallback(async () => {
    const [ov, act] = await Promise.all([
      fetch("/api/dashboard/overview", { cache: "no-store" }),
      fetch("/api/dashboard/activity?limit=40", { cache: "no-store" }),
    ]);
    if (ov.status === 401 || act.status === 401) {
      setPhase("login");
      return;
    }
    if (!ov.ok || !act.ok) {
      setError("Couldn't load your dashboard.");
      setPhase("error");
      return;
    }
    const overview = (await ov.json()) as OverviewMetrics;
    const activity = (await act.json()) as { events: TapEvent[]; nextCursor: string | null };
    seenRef.current = new Set(activity.events.map((e) => e.id));
    cursorRef.current = activity.events[0] ? cursorOf(activity.events[0]) : null;
    setMetrics(overview);
    setFeed(activity.events);
    setOlderCursor(activity.nextCursor);
    setError("");
    setPhase("ready");
    void loadReviews();
    connect();
  }, [connect, loadReviews]);

  // ——— paginate older activity (existing cursor API) ———
  const loadMore = useCallback(async () => {
    if (!olderCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/dashboard/activity?limit=40&cursor=${encodeURIComponent(olderCursor)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { events: TapEvent[]; nextCursor: string | null };
        setFeed((prev) => {
          const merged = [...prev];
          for (const e of data.events) {
            if (!seenRef.current.has(e.id)) {
              seenRef.current.add(e.id);
              merged.push(e);
            }
          }
          return merged;
        });
        setOlderCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [olderCursor, loadingMore]);

  useEffect(() => {
    loadRef.current = () => void load();
    void (async () => {
      await load();
    })();
    return () => {
      esRef.current?.close();
      if (reconcileRef.current) clearTimeout(reconcileRef.current);
    };
  }, [load]);

  // ——— relative-time ticker + online/offline awareness ———
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    const onOffline = () => setConn("offline");
    const onOnline = () => connect();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [connect]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/wifi/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.status === 200) {
      setPassword("");
      setPhase("loading");
      void load();
    } else {
      setError("That password didn't work.");
    }
  }

  async function shareProfile() {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: business.name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  // —————————————————————————————— render: gates

  if (phase === "loading") return <SkeletonHome />;
  if (phase === "error") {
    return (
      <ErrorScreen
        message={error || "Something went wrong."}
        onRetry={() => {
          setPhase("loading");
          void load();
        }}
      />
    );
  }
  if (phase === "login") {
    return (
      <LoginScreen
        password={password}
        setPassword={setPassword}
        onSubmit={login}
        busy={busy}
        error={error}
      />
    );
  }

  const m = metrics!;
  const shownFeed = filter === "ALL" ? feed : feed.filter((e) => e.type === filter);

  return (
    <div className="od-root">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="od-shell od-scroll pt-[max(0.75rem,env(safe-area-inset-top))]">
        <DashHeader
          tab={tab}
          conn={conn}
          onMenu={() => setTab("more")}
          onNavigate={setTab}
        />

        <main className="mt-3">
          {tab === "home" && (
            <HomeView
              m={m}
              feed={feed}
              reviews={reviews}
              now={now}
              lastLiveId={lastLiveId}
              conn={conn}
              onSeeAllActivity={() => setTab("activity")}
              onSeeReviews={() => setTab("reviews")}
              onSeeTags={() => setTab("tags")}
              onShare={shareProfile}
            />
          )}
          {tab === "activity" && (
            <ActivityView
              feed={shownFeed}
              now={now}
              lastLiveId={lastLiveId}
              filter={filter}
              setFilter={setFilter}
              conn={conn}
              olderCursor={olderCursor}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          )}
          {tab === "reviews" && <ReviewsView reviews={reviews} now={now} />}
          {tab === "tags" && <TagsView tags={m.topTags} now={now} />}
          {tab === "more" && <MoreView m={m} conn={conn} />}
        </main>
      </div>

      <BottomNav tab={tab} onNavigate={setTab} />
    </div>
  );
}

// —————————————————————————————— header

function DashHeader({
  tab,
  conn,
  onMenu,
  onNavigate,
}: {
  tab: TabKey;
  conn: Conn;
  onMenu: () => void;
  onNavigate: (t: TabKey) => void;
}) {
  const title = tab === "home" ? business.name : TABS.find((t) => t.key === tab)?.label ?? "";
  return (
    <header className="pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <LiveDot conn={conn} withLabel />
            {tab === "home" && (
              <span className="text-[13px] text-[color:var(--od-ink-2)]">· {greeting()}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Menu"
          className="od-press flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[color:var(--od-border-2)] bg-[color:var(--od-surface)] text-[15px] font-semibold text-[color:var(--od-accent)]"
        >
          {business.name.slice(0, 1).toUpperCase()}
        </button>
      </div>

      {/* Desktop tab bar (hidden on mobile; bottom nav takes over there) */}
      <nav className="od-desk-nav mt-4 gap-1 rounded-2xl border border-[color:var(--od-border)] bg-[color:var(--od-surface)] p-1" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onNavigate(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
              tab === t.key
                ? "bg-[color:var(--od-accent-soft)] text-[color:var(--od-accent)]"
                : "text-[color:var(--od-ink-2)] hover:text-[color:var(--od-ink)]"
            }`}
          >
            <t.Icon size={15} aria-hidden />
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

type Conn = "connecting" | "live" | "reconnecting" | "offline";

function LiveDot({ conn, withLabel = false }: { conn: Conn; withLabel?: boolean }) {
  const label =
    conn === "live" ? "Live" : conn === "offline" ? "Offline" : conn === "connecting" ? "Connecting" : "Reconnecting";
  const state = conn === "live" ? "live" : conn === "offline" ? "offline" : "reconnecting";
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
      <span className="od-live-dot" data-state={state} aria-hidden />
      {withLabel && (
        <span className="text-[13px] font-semibold text-[color:var(--od-ink-2)]">{label}</span>
      )}
    </span>
  );
}

// —————————————————————————————— HOME

function HomeView({
  m,
  feed,
  reviews,
  now,
  lastLiveId,
  conn,
  onSeeAllActivity,
  onSeeReviews,
  onSeeTags,
  onShare,
}: {
  m: OverviewMetrics;
  feed: TapEvent[];
  reviews: ReviewData | null;
  now: number;
  lastLiveId: string | null;
  conn: Conn;
  onSeeAllActivity: () => void;
  onSeeReviews: () => void;
  onSeeTags: () => void;
  onShare: () => void;
}) {
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const recent = feed.slice(0, 5);
  const avg = reviews?.analytics.averageRating ?? m.averageRating;
  const reviewCount = reviews?.analytics.totalRatings ?? m.reviews;
  const latest = reviews?.feedback?.[0];

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
      {/* HERO — today */}
      <section className="od-card p-5 md:col-span-2" aria-label="Today at a glance">
        <div className="flex items-center justify-between">
          <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--od-ink-3)]">
            Today
          </h2>
          <span className="text-[12px] text-[color:var(--od-ink-3)]">{dateLabel}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
          <BigStat
            Icon={Nfc}
            tone="tap"
            value={m.tapsToday}
            label="NFC taps"
            foot={`${fmt(m.totalTaps)} all-time`}
          />
          <BigStat
            Icon={MessageCircle}
            tone="wa"
            value={m.whatsappClicksToday}
            label="WhatsApp"
            foot={`${fmt(m.whatsappClicks)} all-time`}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[color:var(--od-border)] pt-4">
          <SmallStat
            Icon={Star}
            tone="review"
            value={fmt(reviewCount)}
            label="Reviews"
            foot={avg ? `${avg.toFixed(1)}★ average` : "No ratings yet"}
          />
          <SmallStat
            Icon={TrendingUp}
            tone="cta"
            value={`${m.conversionRate}%`}
            label="Conversion"
            foot="tap → WhatsApp"
          />
        </div>
      </section>

      {/* LIVE ACTIVITY — Tier 1, directly under the hero */}
      <section className="od-card overflow-hidden md:col-span-2">
        <div className="flex items-center justify-between px-5 pt-[1.15rem]">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
            Live activity <LiveDot conn={conn} />
          </h2>
          <button
            type="button"
            onClick={onSeeAllActivity}
            className="od-press inline-flex items-center gap-0.5 text-[13px] font-semibold text-[color:var(--od-accent)]"
          >
            View all <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState Icon={Activity} title="No activity yet" body="Tap a tag or open your page to see it here — instantly." />
          </div>
        ) : (
          <ul className="mt-2 px-2 pb-2">
            {recent.map((e, i) => (
              <ActivityRow key={e.id} e={e} now={now} isNew={e.id === lastLiveId} emphasize={i === 0} />
            ))}
          </ul>
        )}
      </section>

      {/* NFC performance */}
      <section className="od-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">NFC performance</h2>
          <span className="text-[12px] text-[color:var(--od-ink-3)]">14 days</span>
        </div>
        <div className="mt-1.5 flex items-end gap-2">
          <span className="text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
            {fmt(m.totalTaps)}
          </span>
          <span className="pb-1 text-[13px] text-[color:var(--od-ink-2)]">
            total · {fmt(m.tapsToday)} today
          </span>
        </div>
        <Chart points={m.taps14d} />
      </section>

      {/* Reviews */}
      <section className="od-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Reviews</h2>
          <button
            type="button"
            onClick={onSeeReviews}
            className="od-press inline-flex items-center gap-0.5 text-[13px] font-semibold text-[color:var(--od-accent)]"
          >
            View all <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        {reviewCount > 0 ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[36px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                {avg.toFixed(1)}
              </span>
              <div>
                <Stars value={avg} />
                <p className="mt-1 text-[12.5px] text-[color:var(--od-ink-2)]">{fmt(reviewCount)} reviews</p>
              </div>
            </div>
            {latest && (
              <blockquote className="od-inset mt-4 p-3.5">
                <Stars value={latest.rating} small />
                <p className="mt-1.5 line-clamp-3 text-[14px] leading-snug text-[color:var(--od-ink)]">
                  “{latest.feedback || "No comment left."}”
                </p>
                <p className="mt-2 text-[11.5px] text-[color:var(--od-ink-3)]">
                  {latest.name ? `${latest.name} · ` : ""}
                  {relTime(latest.createdAt, now)}
                </p>
              </blockquote>
            )}
          </>
        ) : (
          <EmptyState
            Icon={Star}
            title="No reviews yet"
            body="Your first customer review will appear here."
          />
        )}
      </section>

      {/* Quick actions */}
      <section className="md:col-span-2">
        <h2 className="od-h px-1">Quick actions</h2>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <QuickAction Icon={Star} label="View reviews" onClick={onSeeReviews} />
          <QuickAction Icon={Tag} label="View tags" onClick={onSeeTags} />
          <QuickAction Icon={Eye} label="Open profile" onClick={() => window.open("/", "_blank", "noopener")} />
          <QuickAction Icon={Share2} label="Share link" onClick={onShare} />
        </div>
      </section>
    </div>
  );
}

// —————————————————————————————— ACTIVITY

function ActivityView({
  feed,
  now,
  lastLiveId,
  filter,
  setFilter,
  conn,
  olderCursor,
  loadingMore,
  onLoadMore,
}: {
  feed: TapEvent[];
  now: number;
  lastLiveId: string | null;
  filter: TapEventType | "ALL";
  setFilter: (f: TapEventType | "ALL") => void;
  conn: Conn;
  olderCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[color:var(--od-ink-2)]">
          <LiveDot conn={conn} /> {conn === "live" ? "Updating live" : "Reconnecting…"}
        </span>
        <label className="relative">
          <span className="sr-only">Filter activity</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as TapEventType | "ALL")}
            className="od-press h-11 rounded-xl border border-[color:var(--od-border-2)] bg-[color:var(--od-surface)] px-3 pr-8 text-[14px] font-medium text-[color:var(--od-ink)] outline-none"
          >
            <option value="ALL">All events</option>
            <option value="NFC_TAP">NFC taps</option>
            <option value="WHATSAPP_CLICK">WhatsApp</option>
            <option value="REVIEW_RECEIVED">Ratings</option>
            <option value="REVIEW_SUBMITTED">Feedback</option>
            <option value="PROFILE_VIEW">Page views</option>
          </select>
        </label>
      </div>

      <section className="od-card overflow-hidden">
        {feed.length === 0 ? (
          <div className="p-5">
            <EmptyState Icon={Inbox} title="No activity yet" body="New taps, WhatsApp clicks and reviews will stream in here." />
          </div>
        ) : (
          <ul className="px-2 py-2">
            {feed.map((e, i) => (
              <ActivityRow key={e.id} e={e} now={now} isNew={e.id === lastLiveId} emphasize={i === 0} />
            ))}
          </ul>
        )}
      </section>

      {olderCursor && feed.length > 0 && (
        <button type="button" onClick={onLoadMore} disabled={loadingMore} className="od-btn od-btn-soft w-full">
          {loadingMore ? <Loader2 size={16} className="spin" aria-hidden /> : "Load older"}
        </button>
      )}
    </div>
  );
}

function ActivityRow({
  e,
  now,
  isNew,
  emphasize = false,
}: {
  e: TapEvent;
  now: number;
  isNew: boolean;
  emphasize?: boolean;
}) {
  const meta = EVENT_META[e.type] ?? EVENT_META.CTA_CLICK;
  const detail = eventDetail(e);
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        isNew ? "od-flash od-rise" : emphasize ? "bg-[color:var(--od-surface-2)]" : ""
      }`}
    >
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
        style={toneStyle(meta.tone)}
      >
        <meta.Icon size={17} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight">{meta.label}</p>
        {detail && <p className="mt-0.5 truncate text-[12.5px] text-[color:var(--od-ink-3)]">{detail}</p>}
      </div>
      <time className="flex-none text-[12px] font-medium tabular-nums text-[color:var(--od-ink-3)]" dateTime={e.createdAt}>
        {relTime(e.createdAt, now)}
      </time>
    </li>
  );
}

// —————————————————————————————— REVIEWS

function ReviewsView({ reviews, now }: { reviews: ReviewData | null; now: number }) {
  if (!reviews) return <SkeletonList rows={4} />;
  const { averageRating, totalRatings, ratingCounts } = reviews.analytics;
  const max = Math.max(1, ...Object.values(ratingCounts));

  return (
    <div className="flex flex-col gap-4">
      <section className="od-card p-5">
        {totalRatings > 0 ? (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-[40px] font-semibold leading-none tabular-nums">{averageRating.toFixed(1)}</div>
              <div className="mt-1"><Stars value={averageRating} /></div>
              <div className="mt-1 text-[12px] text-[color:var(--od-ink-3)]">{fmt(totalRatings)} reviews</div>
            </div>
            <div className="flex-1">
              {[5, 4, 3, 2, 1].map((r) => (
                <div key={r} className="flex items-center gap-2 py-0.5">
                  <span className="w-3 text-right text-[11px] tabular-nums text-[color:var(--od-ink-3)]">{r}</span>
                  <Star size={11} className="text-[color:var(--od-review)]" fill="currentColor" aria-hidden />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--od-surface-2)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--od-review)]"
                      style={{ width: `${((ratingCounts[String(r)] ?? 0) / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState Icon={Star} title="No reviews yet" body="When guests leave a rating or private feedback, it shows up here." />
        )}
      </section>

      {reviews.feedback.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="od-h px-1">Latest feedback</h2>
          {reviews.feedback.slice(0, 8).map((f) => (
            <article key={f.id} className="od-card p-4">
              <div className="flex items-center justify-between">
                <Stars value={f.rating} small />
                <time className="text-[11.5px] text-[color:var(--od-ink-3)]" dateTime={f.createdAt}>
                  {relTime(f.createdAt, now)}
                </time>
              </div>
              <p className="mt-1.5 text-[14.5px] leading-snug text-[color:var(--od-ink)]">
                “{f.feedback || "No comment left."}”
              </p>
              {f.name && <p className="mt-1 text-[12px] text-[color:var(--od-ink-3)]">— {f.name}</p>}
            </article>
          ))}
        </section>
      )}

      <Link href="/admin/reviews" className="od-btn od-btn-soft w-full">
        Open full reviews admin <ArrowUpRight size={16} aria-hidden />
      </Link>
    </div>
  );
}

// —————————————————————————————— TAGS

function TagsView({ tags, now }: { tags: OverviewMetrics["topTags"]; now: number }) {
  if (tags.length === 0) {
    return (
      <section className="od-card p-5">
        <EmptyState Icon={QrCode} title="No tags yet" body="Create an Aries Tap tag to start tracking taps." />
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {tags.map((t) => (
        <div key={t.code} className="od-card od-press flex items-center gap-3 p-4">
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full"
            style={toneStyle("tap")}
          >
            <Nfc size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold">{t.code}</span>
              <StatusPill active={t.isActive} />
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-[color:var(--od-ink-3)]">
              {t.label || "Aries Tap tag"}
              {t.lastActivity ? ` · ${relTime(t.lastActivity, now)}` : ""}
            </p>
          </div>
          <div className="flex-none text-right">
            <div className="text-[18px] font-semibold tabular-nums leading-none">{fmt(t.taps)}</div>
            <div className="mt-0.5 text-[11px] text-[color:var(--od-ink-3)]">{fmt(t.tapsToday)} today</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={active ? toneStyle("wa") : { color: "var(--od-ink-3)", background: "var(--od-surface-2)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "var(--od-wa)" : "var(--od-ink-3)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// —————————————————————————————— MORE

function MoreView({ m, conn }: { m: OverviewMetrics; conn: Conn }) {
  const links = [
    { href: "/admin", label: "Sign-ups & leads", Icon: Home },
    { href: "/admin/reviews", label: "Reviews admin", Icon: Star },
    { href: "/admin/play", label: "Play & Win", Icon: Gamepad2 },
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="od-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--od-accent-soft)] text-[18px] font-semibold text-[color:var(--od-accent)]">
            {business.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-[17px] font-semibold">{business.name}</p>
            <p className="text-[12.5px] text-[color:var(--od-ink-2)]">{business.meta ?? "Aries Tap"}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[color:var(--od-surface-2)] px-3.5 py-3">
          <span className="text-[13px] font-medium text-[color:var(--od-ink-2)]">Live connection</span>
          <LiveDot conn={conn} withLabel />
        </div>
      </section>

      <section className="od-card overflow-hidden">
        {links.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={`od-press flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-[color:var(--od-border)]" : ""}`}
          >
            <l.Icon size={18} className="text-[color:var(--od-accent)]" aria-hidden />
            <span className="flex-1 text-[15px] font-medium">{l.label}</span>
            <ChevronRight size={16} className="text-[color:var(--od-ink-3)]" aria-hidden />
          </Link>
        ))}
      </section>

      <p className="px-1 text-center text-[11.5px] text-[color:var(--od-ink-3)]">
        {fmt(m.totalEvents)} events tracked · {fmt(m.activeTags)} active tags
      </p>
    </div>
  );
}

// —————————————————————————————— shared bits

function BigStat({
  Icon,
  tone,
  value,
  label,
  foot,
}: {
  Icon: LucideIcon;
  tone: Tone;
  value: number;
  label: string;
  foot: string;
}) {
  return (
    <div>
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={toneStyle(tone)}>
        <Icon size={16} strokeWidth={2} aria-hidden />
      </span>
      <div key={value} className="od-pop mt-2 text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
        {fmt(value)}
      </div>
      <div className="mt-1 text-[14px] font-medium">{label}</div>
      <div className="text-[12px] text-[color:var(--od-ink-3)]">{foot}</div>
    </div>
  );
}

function SmallStat({
  Icon,
  tone,
  value,
  label,
  foot,
}: {
  Icon: LucideIcon;
  tone: Tone;
  value: string;
  label: string;
  foot: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={toneStyle(tone)}>
        <Icon size={16} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <div key={value} className="od-pop text-[20px] font-semibold leading-none tabular-nums">{value}</div>
        <div className="mt-0.5 text-[12px] font-medium text-[color:var(--od-ink-2)]">{label}</div>
        <div className="truncate text-[11px] text-[color:var(--od-ink-3)]">{foot}</div>
      </div>
    </div>
  );
}

function Chart({ points }: { points: OverviewMetrics["taps14d"] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div className="mt-4">
      <div className="flex h-[76px] items-end gap-[4px]" aria-hidden>
        {points.map((p, i) => {
          const last = i === points.length - 1;
          // Non-zero days get a legible minimum; zero days show only the track.
          const h = p.count === 0 ? 0 : Math.max(12, (p.count / max) * 100);
          return (
            <div
              key={p.date}
              className="od-chart-col"
              title={`${p.date}: ${p.count} tap${p.count === 1 ? "" : "s"}`}
            >
              <span className="od-chart-track" />
              <span
                className="od-chart-bar"
                style={{
                  height: `${h}%`,
                  background: last
                    ? "var(--od-accent)"
                    : "color-mix(in srgb, var(--od-accent) 34%, transparent)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[color:var(--od-ink-3)]">
        <span>Past 2 weeks</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--od-accent)" }} />
          Today
        </span>
      </div>
    </div>
  );
}

function Stars({ value, small = false }: { value: number; small?: boolean }) {
  const size = small ? 12 : 15;
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= full ? "text-[color:var(--od-review)]" : "text-[color:var(--od-border-2)]"}
          fill={i <= full ? "currentColor" : "none"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function QuickAction({ Icon, label, onClick }: { Icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="od-card od-press flex items-center gap-3 p-4 text-left"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[color:var(--od-accent-soft)] text-[color:var(--od-accent)]">
        <Icon size={18} aria-hidden />
      </span>
      <span className="text-[14.5px] font-semibold">{label}</span>
    </button>
  );
}

function EmptyState({ Icon, title, body }: { Icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--od-surface-2)] text-[color:var(--od-ink-3)]">
        <Icon size={22} aria-hidden />
      </span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[16rem] text-[13px] text-[color:var(--od-ink-2)]">{body}</p>
    </div>
  );
}

function BottomNav({ tab, onNavigate }: { tab: TabKey; onNavigate: (t: TabKey) => void }) {
  return (
    <nav className="od-nav" aria-label="Primary">
      <div className="od-nav-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onNavigate(t.key)}
            className="od-nav-item"
            aria-current={tab === t.key ? "page" : undefined}
            aria-label={t.label}
          >
            <span className="od-nav-ic">
              <t.Icon size={20} strokeWidth={tab === t.key ? 2.4 : 1.9} aria-hidden />
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// —————————————————————————————— gates: login / loading / error

function LoginScreen({
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
            {business.name.slice(0, 1).toUpperCase()}
          </span>
          <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.02em]">{business.name}</h1>
          <p className="mt-1 text-[14px] text-[color:var(--od-ink-2)]">Live owner dashboard</p>
        </div>

        <form onSubmit={onSubmit} className="od-card mt-6 p-5">
          <label htmlFor="od-pw" className="text-[13px] font-semibold text-[color:var(--od-ink-2)]">
            Admin password
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--od-border-2)] bg-[color:var(--od-surface-2)] px-3.5">
            <Lock size={16} className="text-[color:var(--od-ink-3)]" aria-hidden />
            <input
              id="od-pw"
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
        <p className="mt-4 text-center text-[12px] text-[color:var(--od-ink-3)]">Aries Tap · real-time analytics</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="od-root flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--od-tap-bg)] text-[color:var(--od-tap)]">
        <AlertCircle size={22} aria-hidden />
      </span>
      <p className="mt-3 text-[16px] font-semibold">{message}</p>
      <p className="mt-1 text-[13px] text-[color:var(--od-ink-2)]">Check your connection and try again.</p>
      <button type="button" onClick={onRetry} className="od-btn od-btn-primary mt-5 w-full max-w-xs">
        <RefreshCw size={16} aria-hidden /> Try again
      </button>
    </div>
  );
}

function SkeletonHome() {
  return (
    <div className="od-root">
      <div className="od-shell od-scroll pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pt-1">
          <div className="od-skel h-7 w-40" />
          <div className="od-skel mt-2 h-4 w-28" />
        </div>
        <div className="od-card mt-4 p-5">
          <div className="od-skel h-4 w-16" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="od-skel h-20" />
            <div className="od-skel h-20" />
          </div>
        </div>
        <div className="od-card mt-4 p-5">
          <div className="od-skel h-24 w-full" />
        </div>
        <div className="od-card mt-4 p-5">
          <div className="od-skel h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="od-card p-4">
          <div className="od-skel h-4 w-24" />
          <div className="od-skel mt-2 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

// Fold a live NFC tap into the tag table without a server round-trip.
function bumpTag(tags: OverviewMetrics["topTags"], e: TapEvent, today: boolean): OverviewMetrics["topTags"] {
  const code = e.tagCode!;
  let found = false;
  const next = tags.map((t) => {
    if (t.code !== code) return t;
    found = true;
    return {
      ...t,
      taps: t.taps + 1,
      tapsToday: today ? t.tapsToday + 1 : t.tapsToday,
      lastActivity: e.createdAt,
    };
  });
  if (!found) {
    next.push({ code, label: "", isActive: true, taps: 1, tapsToday: today ? 1 : 0, lastActivity: e.createdAt });
  }
  return next.sort((a, b) => b.taps - a.taps).slice(0, 8);
}

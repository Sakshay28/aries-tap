"use client";

// The owner's phone dashboard — deliberately simple. Four things, nothing more:
//
//   1. Taps     — total NFC taps across every tag in the venue (tap → per table)
//   2. WiFi      — how many guests joined WiFi (tap → every number collected)
//   3. Reviews   — total ratings + average (tap → written reviews, by table)
//   4. AI Chat   — how many questions guests asked (tap → the full history)
//
// One tenant, one password. Every number is confirmed server-side behind the
// signed admin cookie, then kept fresh: a Server-Sent Events stream nudges a
// refetch the instant a tap lands (so 2 tags or 40, it's live), and a slow poll
// covers WiFi and chat, which don't ride the tap stream. Tapping a tile opens a
// full-screen list for that metric; a back arrow returns to the grid.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  MessageCircle,
  Nfc,
  Phone,
  RefreshCw,
  Star,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { business } from "@/lib/content";

// —————————————————————————————— shapes (only the fields these tiles use)

type TagStat = { code: string; label: string; taps: number; tapsToday: number };
export type Overview = {
  totalTaps: number;
  tapsToday: number;
  topTags: TagStat[];
};
type Lead = { id: string; phone: string; table: string; createdAt: string };
export type WifiData = { stats: { total: number; today: number }; leads: Lead[] };
export type Feedback = {
  id: string;
  rating: number;
  feedback: string;
  table: string;
  createdAt: string;
  ai: { summary: string } | null;
};
export type ReviewAnalytics = { totalRatings: number; averageRating: number };
type ChatMsg = { id: string; table: string; question: string; answer: string; createdAt: string };
export type ChatData = { stats: { total: number; today: number }; messages: ChatMsg[] };

export type Tile = "taps" | "wifi" | "reviews" | "chat";

// The eight numbers the four tiles show — shared by the single-venue dashboard
// and the multi-venue owner view so both render the identical grid.
export type Counts = {
  taps: number;
  tapsToday: number;
  wifiTotal: number;
  wifiToday: number;
  reviewTotal: number;
  avg: number;
  chatTotal: number;
  chatToday: number;
};

// —————————————————————————————— formatting

export function fmt(n: number): string {
  return n.toLocaleString();
}

// Compact "how long ago" — the only time format a phone glance needs.
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function tableLabel(table: string): string {
  return table ? `Table ${table}` : "No table";
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} star${n === 1 ? "" : "s"}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={i <= n ? "text-[color:var(--od-review)]" : "text-[color:var(--od-ink-3)]"}
          fill={i <= n ? "currentColor" : "none"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function TableBadge({ table }: { table: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: table ? "var(--od-accent)" : "var(--od-ink-3)",
        background: table ? "var(--od-accent-soft)" : "var(--od-surface-2)",
      }}
    >
      {tableLabel(table)}
    </span>
  );
}

// —————————————————————————————— main

export function OverviewClient() {
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [wifi, setWifi] = useState<WifiData | null>(null);
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [chat, setChat] = useState<ChatData | null>(null);

  const [tile, setTile] = useState<Tile | null>(null);
  const [live, setLive] = useState(false);

  // —— individual section loaders (each also feeds its tile's headline count) ——

  const loadOverview = useCallback(async () => {
    const r = await fetch("/api/dashboard/overview", { cache: "no-store" });
    if (r.status === 401) return "unauth" as const;
    if (!r.ok) throw new Error("overview");
    setOverview((await r.json()) as Overview);
    return "ok" as const;
  }, []);

  const loadWifi = useCallback(async () => {
    const r = await fetch("/api/wifi/admin/leads", { cache: "no-store" });
    if (!r.ok) return;
    setWifi((await r.json()) as WifiData);
  }, []);

  const loadReviews = useCallback(async () => {
    const r = await fetch("/api/review/admin", { cache: "no-store" });
    if (!r.ok) return;
    const data = (await r.json()) as { analytics: ReviewAnalytics; feedback: Feedback[] };
    setAnalytics(data.analytics);
    setFeedback(data.feedback);
  }, []);

  const loadChat = useCallback(async () => {
    const r = await fetch("/api/chat/admin", { cache: "no-store" });
    if (!r.ok) return;
    setChat((await r.json()) as ChatData);
  }, []);

  const loadAll = useCallback(async () => {
    const status = await loadOverview();
    if (status === "unauth") {
      setPhase("login");
      return;
    }
    await Promise.all([loadWifi(), loadReviews(), loadChat()]);
    setPhase("ready");
  }, [loadOverview, loadWifi, loadReviews, loadChat]);

  // First load: try the confirmed snapshot; a 401 drops us to the login gate.
  useEffect(() => {
    loadAll().catch(() => setPhase("error"));
  }, [loadAll]);

  // —— live wire: the tap stream signals "something changed, refetch" ——
  // We never count SSE frames directly (a reconnect replays history); we just
  // debounce an authoritative refetch of the numbers that ride the stream.
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (phase !== "ready") return;
    const es = new EventSource("/api/dashboard/stream");
    const nudge = () => {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        loadOverview().catch(() => {});
        loadReviews().catch(() => {});
      }, 400);
    };
    es.addEventListener("ready", () => setLive(true));
    es.addEventListener("tap", nudge);
    es.onerror = () => setLive(false);

    // WiFi + chat aren't tap events, so a slow poll keeps them current.
    const poll = setInterval(() => {
      loadWifi().catch(() => {});
      loadChat().catch(() => {});
    }, 25_000);

    return () => {
      es.close();
      clearInterval(poll);
      clearTimeout(debounce.current);
    };
  }, [phase, loadOverview, loadReviews, loadWifi, loadChat]);

  // Opening a tile refetches that section, so its list is fresh on entry.
  function open(t: Tile) {
    setTile(t);
    if (t === "taps") loadOverview().catch(() => {});
    if (t === "wifi") loadWifi().catch(() => {});
    if (t === "reviews") loadReviews().catch(() => {});
    if (t === "chat") loadChat().catch(() => {});
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/wifi/admin/login", {
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
      await loadAll();
    } catch {
      setLoginError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // —— gates ——
  if (phase === "login")
    return (
      <LoginScreen
        password={password}
        setPassword={setPassword}
        onSubmit={login}
        busy={busy}
        error={loginError}
      />
    );
  if (phase === "loading") return <Splash />;
  if (phase === "error")
    return <ErrorScreen onRetry={() => (setPhase("loading"), loadAll().catch(() => setPhase("error")))} />;

  // —— headline counts ——
  const taps = overview?.totalTaps ?? 0;
  const tapsToday = overview?.tapsToday ?? 0;
  const wifiTotal = wifi?.stats.total ?? 0;
  const wifiToday = wifi?.stats.today ?? 0;
  const reviewTotal = analytics?.totalRatings ?? 0;
  const avg = analytics?.averageRating ?? 0;
  const chatTotal = chat?.stats.total ?? 0;
  const chatToday = chat?.stats.today ?? 0;

  return (
    <div className="od-root min-h-svh">
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        {tile === null ? (
          <>
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{business.name}</h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[color:var(--od-ink-2)]">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: live ? "var(--od-live)" : "var(--od-off)" }}
                    aria-hidden
                  />
                  {live ? "Live" : "Reconnecting…"}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--od-espresso)] text-[18px] font-semibold text-[color:var(--od-bg)]">
                {business.name.slice(0, 1).toUpperCase()}
              </span>
            </header>

            <div className="mt-6">
              <MetricGrid
                counts={{ taps, tapsToday, wifiTotal, wifiToday, reviewTotal, avg, chatTotal, chatToday }}
                onOpen={open}
              />
            </div>

            <p className="mt-6 text-center text-[12px] text-[color:var(--od-ink-3)]">
              Tap a box for details · Aries Tap
            </p>
          </>
        ) : (
          <Detail
            tile={tile}
            onBack={() => setTile(null)}
            overview={overview}
            wifi={wifi}
            analytics={analytics}
            feedback={feedback}
            chat={chat}
          />
        )}
      </div>
    </div>
  );
}

// —————————————————————————————— the four tiles

const TONE_LABEL: Record<Tile, string> = {
  taps: "Total taps",
  wifi: "WiFi joined",
  reviews: "Reviews",
  chat: "AI chats",
};

// The four tiles, in one place, so every dashboard renders the identical grid.
export function MetricGrid({
  counts,
  onOpen,
}: {
  counts: Counts;
  onOpen: (t: Tile) => void;
}) {
  const { taps, tapsToday, wifiTotal, wifiToday, reviewTotal, avg, chatTotal, chatToday } = counts;
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <MetricTile
        Icon={Nfc}
        tone="tap"
        label="Total taps"
        value={fmt(taps)}
        sub={tapsToday > 0 ? `+${fmt(tapsToday)} today` : "across all tags"}
        onClick={() => onOpen("taps")}
      />
      <MetricTile
        Icon={Wifi}
        tone="wa"
        label="WiFi joined"
        value={fmt(wifiTotal)}
        sub={wifiToday > 0 ? `+${fmt(wifiToday)} today` : "numbers collected"}
        onClick={() => onOpen("wifi")}
      />
      <MetricTile
        Icon={Star}
        tone="review"
        label="Reviews"
        value={fmt(reviewTotal)}
        sub={reviewTotal > 0 ? `${avg.toFixed(1)}★ average` : "no reviews yet"}
        onClick={() => onOpen("reviews")}
      />
      <MetricTile
        Icon={MessageCircle}
        tone="cta"
        label="AI chats"
        value={fmt(chatTotal)}
        sub={chatToday > 0 ? `+${fmt(chatToday)} today` : "questions asked"}
        onClick={() => onOpen("chat")}
      />
    </div>
  );
}

function MetricTile({
  Icon,
  tone,
  label,
  value,
  sub,
  onClick,
}: {
  Icon: LucideIcon;
  tone: "tap" | "wa" | "review" | "cta";
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="od-card od-press flex flex-col items-start gap-3 p-4 text-left"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ color: `var(--od-${tone})`, background: `var(--od-${tone}-bg)` }}
      >
        <Icon size={19} aria-hidden />
      </span>
      <span className="text-[30px] font-semibold leading-none tracking-[-0.02em]">{value}</span>
      <span className="flex w-full items-end justify-between">
        <span className="flex flex-col">
          <span className="text-[14px] font-semibold">{label}</span>
          <span className="text-[12px] text-[color:var(--od-ink-2)]">{sub}</span>
        </span>
        <ChevronRight size={17} className="text-[color:var(--od-ink-3)]" aria-hidden />
      </span>
    </button>
  );
}

// —————————————————————————————— detail views

export function Detail({
  tile,
  onBack,
  overview,
  wifi,
  analytics,
  feedback,
  chat,
}: {
  tile: Tile;
  onBack: () => void;
  overview: Overview | null;
  wifi: WifiData | null;
  analytics: ReviewAnalytics | null;
  feedback: Feedback[];
  chat: ChatData | null;
}) {
  return (
    <>
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="od-press flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--od-surface)] shadow-[var(--od-elev)]"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{TONE_LABEL[tile]}</h1>
      </header>

      <div className="mt-5">
        {tile === "taps" && <TapsDetail overview={overview} />}
        {tile === "wifi" && <WifiDetail wifi={wifi} />}
        {tile === "reviews" && <ReviewsDetail analytics={analytics} feedback={feedback} />}
        {tile === "chat" && <ChatDetail chat={chat} />}
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-card p-8 text-center text-[14px] text-[color:var(--od-ink-2)]">{children}</div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="od-card flex items-center gap-3 p-3.5">{children}</li>;
}

// —— Taps: per-table breakdown, busiest first ——
function TapsDetail({ overview }: { overview: Overview | null }) {
  // Every tag, not only the ones with activity. A table sitting on zero is the
  // single most actionable row here: it means the tent is missing or the NFC
  // tag was never programmed, and hiding it makes that indistinguishable from
  // a quiet night. Tapped tables lead, untapped ones follow, muted.
  // Busiest first; ties fall back to natural table order so T2 precedes T10.
  const all = [...(overview?.topTags ?? [])].sort(
    (a, b) => b.taps - a.taps || a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
  if (!all.length) return <Empty>No tags registered yet.</Empty>;

  const active = all.filter((t) => t.taps > 0);
  const idle = all.filter((t) => t.taps === 0);

  return (
    <>
      <p className="mb-3 text-[13px] text-[color:var(--od-ink-2)]">
        {fmt(overview?.totalTaps ?? 0)} taps across {active.length} of {all.length} table
        {all.length === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-2.5">
        {active.map((t) => (
          <Row key={t.code}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: "var(--od-tap)", background: "var(--od-tap-bg)" }}
            >
              <Nfc size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{t.label || t.code}</span>
              <span className="text-[12px] text-[color:var(--od-ink-3)]">{t.code}</span>
            </span>
            <span className="text-right">
              <span className="block text-[17px] font-semibold">{fmt(t.taps)}</span>
              {t.tapsToday > 0 && (
                <span className="text-[11px] text-[color:var(--od-live)]">+{fmt(t.tapsToday)} today</span>
              )}
            </span>
          </Row>
        ))}
      </ul>

      {idle.length > 0 && (
        <>
          <p className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[color:var(--od-ink-3)]">
            No taps yet · {idle.length}
          </p>
          <p className="mb-3 text-[12px] text-[color:var(--od-ink-3)]">
            If one of these stays empty while the room is busy, check that its tent is on the table and
            its tag is programmed.
          </p>
          <ul className="flex flex-col gap-2">
            {idle.map((t) => (
              <Row key={t.code}>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ color: "var(--od-ink-3)", background: "var(--od-surface-2)" }}
                >
                  <Nfc size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[color:var(--od-ink-2)]">
                    {t.label || t.code}
                  </span>
                  <span className="text-[11px] text-[color:var(--od-ink-3)]">{t.code}</span>
                </span>
                <span className="text-[14px] font-semibold text-[color:var(--od-ink-3)]">0</span>
              </Row>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// —— WiFi: every number collected, newest first, with its table ——
function WifiDetail({ wifi }: { wifi: WifiData | null }) {
  const leads = wifi?.leads ?? [];
  if (!leads.length) return <Empty>No WiFi numbers collected yet.</Empty>;
  return (
    <>
      <p className="mb-3 text-[13px] text-[color:var(--od-ink-2)]">
        {fmt(wifi?.stats.total ?? 0)} number{leads.length === 1 ? "" : "s"} collected
      </p>
      <ul className="flex flex-col gap-2.5">
        {leads.map((l) => (
          <Row key={l.id}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: "var(--od-wa)", background: "var(--od-wa-bg)" }}
            >
              <Phone size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold tabular-nums">{l.phone}</span>
              <span className="text-[12px] text-[color:var(--od-ink-3)]">{ago(l.createdAt)}</span>
            </span>
            <TableBadge table={l.table} />
          </Row>
        ))}
      </ul>
    </>
  );
}

// —— Reviews: rating summary, then written reviews grouped by table ——
function ReviewsDetail({
  analytics,
  feedback,
}: {
  analytics: ReviewAnalytics | null;
  feedback: Feedback[];
}) {
  // Group written reviews by table so the owner sees which table said what.
  const groups = new Map<string, Feedback[]>();
  for (const f of feedback) {
    const key = f.table || "";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (!a[0]) return 1; // "No table" sinks to the bottom
    if (!b[0]) return -1;
    return a[0].localeCompare(b[0], undefined, { numeric: true });
  });

  return (
    <>
      <div className="od-card mb-4 flex items-center justify-between p-4">
        <div>
          <span className="text-[28px] font-semibold leading-none">
            {(analytics?.averageRating ?? 0).toFixed(1)}
          </span>
          <div className="mt-1">
            <Stars n={Math.round(analytics?.averageRating ?? 0)} />
          </div>
        </div>
        <div className="text-right">
          <span className="block text-[15px] font-semibold">{fmt(analytics?.totalRatings ?? 0)}</span>
          <span className="text-[12px] text-[color:var(--od-ink-2)]">total reviews</span>
        </div>
      </div>

      {feedback.length === 0 ? (
        <Empty>No written reviews yet — only star ratings so far.</Empty>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-[color:var(--od-ink-2)]">
            {fmt(feedback.length)} written review{feedback.length === 1 ? "" : "s"}, by table
          </p>
          <div className="flex flex-col gap-4">
            {ordered.map(([table, items]) => (
              <section key={table || "none"}>
                <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[color:var(--od-ink-2)]">
                  <TableBadge table={table} />
                  <span>
                    {items.length} review{items.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {items.map((f) => (
                    <li key={f.id} className="od-card p-3.5">
                      <div className="flex items-center justify-between">
                        <Stars n={f.rating} />
                        <span className="text-[12px] text-[color:var(--od-ink-3)]">{ago(f.createdAt)}</span>
                      </div>
                      {f.feedback && <p className="mt-2 text-[14px] leading-snug">{f.feedback}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// —— AI Chat: what guests asked, newest first ——
function ChatDetail({ chat }: { chat: ChatData | null }) {
  const msgs = chat?.messages ?? [];
  if (!msgs.length)
    return <Empty>No questions asked yet. Guest questions to the AI Host will show up here.</Empty>;
  return (
    <>
      <p className="mb-3 text-[13px] text-[color:var(--od-ink-2)]">
        {fmt(chat?.stats.total ?? 0)} question{msgs.length === 1 ? "" : "s"} asked
      </p>
      <ul className="flex flex-col gap-2.5">
        {msgs.map((m) => (
          <li key={m.id} className="od-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <TableBadge table={m.table} />
              <span className="text-[12px] text-[color:var(--od-ink-3)]">{ago(m.createdAt)}</span>
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-snug">{m.question}</p>
            {m.answer && (
              <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-[color:var(--od-ink-2)]">
                {m.answer}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
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
          <p className="mt-1 text-[14px] text-[color:var(--od-ink-2)]">Owner dashboard</p>
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
        <p className="mt-4 text-center text-[12px] text-[color:var(--od-ink-3)]">Aries Tap</p>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="od-root flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--od-tap-bg)] text-[color:var(--od-tap)]">
        <AlertCircle size={22} aria-hidden />
      </span>
      <p className="mt-3 text-[16px] font-semibold">Couldn&apos;t load the dashboard</p>
      <p className="mt-1 text-[13px] text-[color:var(--od-ink-2)]">Check your connection and try again.</p>
      <button type="button" onClick={onRetry} className="od-btn od-btn-primary mt-5 w-full max-w-xs">
        <RefreshCw size={16} aria-hidden /> Try again
      </button>
    </div>
  );
}

function Splash() {
  return (
    <div className="od-root flex min-h-svh items-center justify-center">
      <Loader2 size={26} className="spin text-[color:var(--od-ink-3)]" aria-hidden />
    </div>
  );
}

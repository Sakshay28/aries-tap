"use client";

// The dashboard's presentational kit — the four metric tiles and their
// full-screen detail lists, plus the small formatting helpers they share.
// Purely visual and data-driven: it takes finished numbers/lists and renders
// them. The multi-venue Command Center (`/owner`) composes these per venue.

import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Nfc,
  Phone,
  Star,
  Wifi,
  type LucideIcon,
} from "lucide-react";

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

// The eight numbers the four tiles show.
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
  const tags = (overview?.topTags ?? []).filter((t) => t.taps > 0).sort((a, b) => b.taps - a.taps);
  if (!tags.length) return <Empty>No taps recorded yet. They&apos;ll appear here the moment a guest taps a tag.</Empty>;
  return (
    <>
      <p className="mb-3 text-[13px] text-[color:var(--od-ink-2)]">
        {fmt(overview?.totalTaps ?? 0)} taps across {tags.length} table{tags.length === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-2.5">
        {tags.map((t) => (
          <Row key={t.code}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: "var(--od-tap)", background: "var(--od-tap-bg)" }}
            >
              <Nfc size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">
                {t.label || tableLabel(t.code)}
              </span>
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

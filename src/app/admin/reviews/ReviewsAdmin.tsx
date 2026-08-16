"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Star,
} from "lucide-react";
import { business } from "@/lib/content";
import { cn } from "@/lib/utils";
import type { Analytics } from "@/lib/review/analytics";
import type { AiCategory, FeedbackRow, ReviewStatus } from "@/lib/review/types";

type Data = { analytics: Analytics; feedback: FeedbackRow[] };

// —————————————————————————————— formatting

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

const STATUS_META: Record<ReviewStatus, { label: string; dot: string }> = {
  open: { label: "Open", dot: "var(--danger)" },
  in_progress: { label: "In Progress", dot: "var(--accent)" },
  resolved: { label: "Resolved", dot: "#5aa469" },
  closed: { label: "Closed", dot: "var(--ink-faint)" },
};

const CATEGORY_LABEL: Record<AiCategory, string> = {
  food: "Food",
  service: "Service",
  ambience: "Ambience",
  cleanliness: "Cleanliness",
  pricing: "Pricing",
  staff: "Staff",
  other: "Other",
};

// —————————————————————————————— root

export function ReviewsAdmin() {
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [data, setData] = useState<Data | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/review/admin");
    if (res.status === 200) {
      setData((await res.json()) as Data);
      setState("ready");
    } else {
      setState("login");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

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
      setState("loading");
      load();
    } else {
      setError("Wrong password.");
    }
  }

  async function onStatus(id: string, patch: { status: ReviewStatus; notes?: string }) {
    // Optimistic — reflect the change immediately, reconcile on failure.
    setData((d) =>
      d
        ? {
            ...d,
            feedback: d.feedback.map((f) =>
              f.id === id
                ? {
                    ...f,
                    status: patch.status,
                    notes: patch.notes ?? f.notes,
                    resolvedAt:
                      patch.status === "resolved" || patch.status === "closed"
                        ? new Date().toISOString()
                        : null,
                  }
                : f
            ),
          }
        : d
    );
    const res = await fetch("/api/review/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) load(); // rollback via refetch
  }

  if (state === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="spin text-ink-faint" aria-hidden />
      </div>
    );
  }

  if (state === "login") {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <div className="glass card-in relative overflow-hidden rounded-3xl p-7">
          <div className="bord" aria-hidden />
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
            <Lock size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">
            {business.name} · Reviews
          </h1>
          <p className="mt-1 text-[13px] text-ink-dim">
            Enter the admin password to view guest feedback.
          </p>
          <form onSubmit={login} className="mt-6">
            <input
              type="password"
              autoFocus
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-line bg-[var(--press)] px-4 py-3.5 text-[15px] text-ink outline-none focus:border-accent placeholder:text-ink-faint"
            />
            {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
            <button
              type="submit"
              disabled={!password || busy}
              className="row mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg disabled:opacity-40"
            >
              {busy ? <Loader2 size={18} className="spin" aria-hidden /> : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const a = data?.analytics;
  const feedback = data?.feedback ?? [];

  return (
    <div className="flex flex-1 flex-col pb-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            aria-label="Back to sign-ups"
            className="row -ml-2 grid h-9 w-9 place-items-center rounded-full"
          >
            <ArrowLeft size={18} strokeWidth={1.75} className="text-ink-dim" aria-hidden />
          </Link>
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Reviews</h1>
            <p className="text-[13px] text-ink-dim">{business.name} · guest feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh"
            className="row grid h-9 w-9 place-items-center rounded-full border border-line text-ink-dim"
          >
            <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
          </button>
          <a
            href="/api/review/admin?format=csv"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Download size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            CSV
          </a>
        </div>
      </header>

      {a && (
        <>
          <FunnelChart funnel={a.funnel} />

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Avg rating" value={a.averageRating ? a.averageRating.toFixed(2) : "—"} sub={`${a.totalRatings} ratings`} />
            <MetricCard label="Positive" value={`${a.positivePct}%`} sub="4–5★" />
            <MetricCard label="Negative" value={`${a.negativePct}%`} sub="≤3★" tone={a.negativePct > 25 ? "warn" : undefined} />
            <MetricCard label="Google CTR" value={`${a.googleCtr}%`} sub="of eligible" />
            <MetricCard label="Avg time" value={fmtDuration(a.avgTimeMs)} sub="in review" />
            <MetricCard label="Repeat" value={`${a.repeatVisitorPct}%`} sub="visitors" />
            <MetricCard label="Sessions" value={String(a.sessions)} sub="opened" />
            <MetricCard label="Open cases" value={String(a.openCount)} sub="unresolved" tone={a.openCount > 0 ? "warn" : undefined} />
          </div>

          <DailyChart daily={a.daily} />

          {Object.values(a.categoryCounts).some((n) => n > 0) && (
            <CategoryBars counts={a.categoryCounts} />
          )}
        </>
      )}

      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          Private feedback
        </h2>
        {feedback.length === 0 ? (
          <p className="glass mt-3 rounded-2xl p-8 text-center text-[13px] text-ink-dim">
            No private feedback yet. Happy guests are sent straight to Google.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {feedback.map((f) => (
              <FeedbackCard key={f.id} row={f} onStatus={onStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// —————————————————————————————— funnel

function FunnelChart({ funnel }: { funnel: Analytics["funnel"] }) {
  const top = Math.max(1, funnel[0]?.count ?? 1);
  return (
    <div className="glass mt-6 rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        Review funnel
      </p>
      <div className="mt-4 space-y-2.5">
        {funnel.map((stage, i) => {
          const prev = i > 0 ? funnel[i - 1].count : stage.count;
          const stepPct = prev > 0 ? Math.round((stage.count / prev) * 100) : 0;
          const widthPct = Math.max(2, Math.round((stage.count / top) * 100));
          return (
            <div key={stage.key}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium">{stage.label}</span>
                <span className="tabular-nums text-ink-dim">
                  {stage.count}
                  {i > 0 && (
                    <span className="ml-2 text-[11px] text-ink-faint">{stepPct}%</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--press)]">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// —————————————————————————————— metric card

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
          tone === "warn" && "text-danger"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}

// —————————————————————————————— daily chart

function DailyChart({ daily }: { daily: Analytics["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="glass mt-3 rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        Daily reviews · 14 days
      </p>
      <div className="mt-4 flex h-24 items-end gap-1.5">
        {daily.map((d) => (
          <div
            key={d.date}
            className="group flex h-full flex-1 flex-col justify-end"
            title={`${d.date} — ${d.count} ratings${d.avg ? `, avg ${d.avg}★` : ""}`}
          >
            <div
              className="w-full rounded-t bg-accent/70 transition-all group-hover:bg-accent"
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ink-faint">
        <span>{daily[0]?.date.slice(5)}</span>
        <span>{daily[daily.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

// —————————————————————————————— category mix

function CategoryBars({ counts }: { counts: Analytics["categoryCounts"] }) {
  const entries = (Object.entries(counts) as [AiCategory, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="glass mt-3 rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        Complaint themes
      </p>
      <div className="mt-4 space-y-2">
        {entries.map(([cat, n]) => (
          <div key={cat} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[12px] text-ink-dim">
              {CATEGORY_LABEL[cat]}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--press)]">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-[12px] tabular-nums text-ink-faint">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// —————————————————————————————— feedback card

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          strokeWidth={1.75}
          className={i <= rating ? "text-accent" : "text-ink-faint"}
          fill={i <= rating ? "currentColor" : "none"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "danger" | "accent" | "muted" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        tone === "danger" && "bg-danger/12 text-danger",
        tone === "accent" && "bg-accent/12 text-accent",
        (!tone || tone === "muted") && "bg-[var(--press)] text-ink-dim"
      )}
    >
      {children}
    </span>
  );
}

function FeedbackCard({
  row,
  onStatus,
}: {
  row: FeedbackRow;
  onStatus: (id: string, patch: { status: ReviewStatus; notes?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(row.notes);
  const [copied, setCopied] = useState(false);
  const notesDirty = notes !== row.notes;

  const priorityTone = row.ai?.priority === "high" ? "danger" : row.ai?.priority === "medium" ? "accent" : "muted";
  const severityTone = row.ai?.severity === "critical" ? "danger" : row.ai?.severity === "moderate" ? "accent" : "muted";

  const meta = useMemo(
    () =>
      [row.table && `Table ${row.table}`, row.device, [row.city, row.country].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" · "),
    [row]
  );

  async function copyReply() {
    if (!row.ai?.suggestedResponse) return;
    try {
      await navigator.clipboard.writeText(row.ai.suggestedResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — text is visible regardless */
    }
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Stars rating={row.rating} />
            <StatusPill status={row.status} />
          </div>
          <span className="shrink-0 text-[11px] text-ink-faint">{fmtTime(row.createdAt)}</span>
        </div>

        {/* AI triage */}
        {row.ai && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={priorityTone}>{row.ai.priority} priority</Badge>
              <Badge tone="muted">{row.ai.department}</Badge>
              <Badge tone={severityTone}>{row.ai.severity}</Badge>
              {row.ai.source === "heuristic" && <Badge tone="muted">auto</Badge>}
            </div>
            <p className="mt-2 text-[13px] font-medium leading-snug text-ink">
              {row.ai.summary}
            </p>
          </div>
        )}

        {/* Guest text */}
        {row.feedback && (
          <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-dim">
            {row.feedback}
          </p>
        )}

        {/* Categories */}
        {row.ai && row.ai.categories.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {row.ai.categories.map((c) => (
              <span key={c} className="rounded-md bg-[var(--press)] px-2 py-0.5 text-[11px] text-ink-dim">
                {CATEGORY_LABEL[c]}
              </span>
            ))}
          </div>
        )}

        {/* Photos */}
        {row.images.length > 0 && (
          <div className="mt-3 flex gap-2">
            {row.images.map((src, i) => (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="h-16 w-16 overflow-hidden rounded-lg border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Feedback photo ${i + 1}`} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}

        {/* Contact */}
        {row.contactRequested && (
          <div className="mt-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
              Callback requested
            </p>
            <div className="mt-1.5 space-y-1 text-[13px]">
              {row.name && <p className="font-medium">{row.name}</p>}
              {row.phone && (
                <a href={`tel:${row.phone}`} className="flex items-center gap-1.5 text-ink-dim">
                  <Phone size={12} strokeWidth={1.75} aria-hidden /> {row.phone}
                </a>
              )}
              {row.email && (
                <a href={`mailto:${row.email}`} className="flex items-center gap-1.5 text-ink-dim">
                  <Mail size={12} strokeWidth={1.75} aria-hidden /> {row.email}
                </a>
              )}
            </div>
          </div>
        )}

        {meta && <p className="mt-3 text-[11px] text-ink-faint">{meta}</p>}
      </div>

      {/* Resolution drawer */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="row flex w-full items-center justify-between border-t border-line px-4 py-2.5 text-[12px] font-medium text-ink-dim"
      >
        <span className="flex items-center gap-1.5">
          <StatusDot status={row.status} />
          Manage
        </span>
        <ChevronDown
          size={15}
          strokeWidth={1.75}
          className={cn("transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="step-in border-t border-line p-4">
          {row.ai?.suggestedResponse && (
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                  Suggested reply
                </p>
                <button
                  type="button"
                  onClick={copyReply}
                  className="flex items-center gap-1 text-[11px] font-medium text-accent"
                >
                  {copied ? <Check size={12} strokeWidth={2.25} aria-hidden /> : <Copy size={12} strokeWidth={1.75} aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1.5 rounded-xl border border-line bg-[var(--press)] p-3 text-[13px] leading-relaxed text-ink-dim">
                {row.ai.suggestedResponse}
              </p>
            </div>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-dim">Status</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(STATUS_META) as ReviewStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatus(row.id, { status: s, notes })}
                className={cn(
                  "row flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-medium",
                  row.status === s ? "border-accent text-accent" : "border-line text-ink-dim"
                )}
              >
                <StatusDot status={s} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
            Internal notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            rows={2}
            placeholder="What did we do about it?"
            className="mt-2 w-full resize-none rounded-xl border border-line bg-[var(--press)] p-3 text-[13px] text-ink outline-none focus:border-accent placeholder:text-ink-faint"
          />
          <button
            type="button"
            disabled={!notesDirty}
            onClick={() => onStatus(row.id, { status: row.status, notes })}
            className="row mt-2 flex h-9 w-full items-center justify-center rounded-xl border border-line text-[12px] font-medium disabled:opacity-40"
          >
            Save notes
          </button>
          {row.resolvedAt && (
            <p className="mt-3 text-[11px] text-ink-faint">
              {row.status === "closed" ? "Closed" : "Resolved"} {fmtTime(row.resolvedAt)}
              {row.resolvedBy && ` · ${row.resolvedBy}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ReviewStatus }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: STATUS_META[status].dot }}
      aria-hidden
    />
  );
}

function StatusPill({ status }: { status: ReviewStatus }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-[var(--press)] px-2 py-0.5 text-[11px] font-medium text-ink-dim">
      <StatusDot status={status} />
      {STATUS_META[status].label}
    </span>
  );
}

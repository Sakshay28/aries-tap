"use client";

// The Play & Win dashboard — the growth engine's cockpit. Same shape as the WiFi
// and Reviews admins: a signed-cookie login gate, then analytics tiles, a
// 14-day trend, a per-game breakdown, and the leads table (with redemption
// status). All reads come from /api/play/admin behind the shared admin cookie.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  Gift,
  Loader2,
  Lock,
  Percent,
  Phone,
  Star,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { business } from "@/lib/content";
import type { ClaimRow, PlaywinAnalytics } from "@/lib/playwin/types";

type Data = { analytics: PlaywinAnalytics; claims: ClaimRow[] };

const GAME_NAMES: Record<string, string> = {
  spin: "Spin the Wheel",
  scratch: "Scratch Card",
  lucky: "Lucky Number",
  flip: "Flip the Card",
  memory: "Memory Match",
  tap: "Tap Challenge",
  box: "Daily Mystery Box",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlayAdmin() {
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [data, setData] = useState<Data | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/play/admin");
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
            {business.name} · Play &amp; Win
          </h1>
          <p className="mt-1 text-[13px] text-ink-dim">Enter the admin password to view the dashboard.</p>
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
  const claims = data?.claims ?? [];
  if (!a) return null;

  const maxDaily = Math.max(1, ...a.daily.map((d) => d.plays));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Play &amp; Win</h1>
          <p className="text-[13px] text-ink-dim">{business.name} · growth engine</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Star size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            Admin
          </Link>
          <a
            href="/api/play/admin?format=csv"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Download size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            CSV
          </a>
        </div>
      </header>

      {/* Headline metrics */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<CalendarDays size={16} />} label="Plays today" value={a.playsToday} />
        <Stat icon={<Users size={16} />} label="Players" value={a.uniqueDevices} />
        <Stat icon={<Percent size={16} />} label="Win rate" value={`${a.winRate}%`} />
        <Stat icon={<Ticket size={16} />} label="Claims" value={a.claims} />
        <Stat icon={<Phone size={16} />} label="Phones" value={a.phonesCollected} />
        <Stat icon={<BadgeCheck size={16} />} label="Redeemed" value={a.redemptions} />
        <Stat icon={<Percent size={16} />} label="Conversion" value={`${a.conversionRate}%`} />
        <Stat icon={<Gift size={16} />} label="Opt-ins" value={a.marketingOptIns} />
      </div>

      {/* Highlights */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Highlight
          icon={<Trophy size={15} />}
          label="Most popular game"
          value={a.popularGame ? GAME_NAMES[a.popularGame.key] ?? a.popularGame.key : "—"}
          sub={a.popularGame ? `${a.popularGame.plays} plays` : ""}
        />
        <Highlight
          icon={<Gift size={15} />}
          label="Top reward claimed"
          value={a.topReward?.title ?? "—"}
          sub={a.topReward ? `${a.topReward.count}×` : ""}
        />
      </div>

      {/* 14-day trend */}
      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          Last 14 days · plays
        </h2>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {a.daily.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.plays} plays, ${d.claims} claims`}>
              <div
                className="w-full rounded-t bg-accent/70"
                style={{ height: `${Math.round((d.plays / maxDaily) * 100)}%`, minHeight: d.plays ? 3 : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-ink-faint">
          <span>{a.daily[0]?.date.slice(5)}</span>
          <span>{a.daily[a.daily.length - 1]?.date.slice(5)}</span>
        </div>
      </section>

      {/* Per-game breakdown */}
      {a.byGame.length > 0 && (
        <section className="glass mt-4 overflow-hidden rounded-2xl">
          <h2 className="border-b border-line px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
            By game
          </h2>
          <ul>
            {a.byGame.map((g, i) => (
              <li
                key={g.key}
                className="flex items-center justify-between px-5 py-3"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <span className="text-[15px] font-medium">{GAME_NAMES[g.key] ?? g.key}</span>
                <span className="text-[13px] text-ink-dim tabular-nums">
                  {g.plays} plays · {g.winRate}% win · {g.claims} claims
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Leads */}
      <section className="glass mt-4 flex-1 overflow-hidden rounded-2xl">
        <h2 className="border-b border-line px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          Recent claims · leads
        </h2>
        {claims.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-ink-dim">No claims yet.</p>
        ) : (
          <ul>
            {claims.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">
                    {c.phone || c.name || "—"}
                    {c.name && c.phone ? <span className="text-ink-dim"> · {c.name}</span> : null}
                  </p>
                  <p className="truncate text-[12px] text-ink-dim">
                    {c.rewardTitle} · {fmtTime(c.createdAt)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
    </div>
  );
}

function Highlight({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      <p className="mt-1.5 truncate text-[16px] font-semibold tracking-[-0.01em]">{value}</p>
      {sub && <p className="text-[12px] text-ink-faint">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: ClaimRow["status"] }) {
  const map = {
    issued: { text: "Issued", cls: "bg-[var(--press)] text-ink-dim" },
    redeemed: { text: "Redeemed", cls: "bg-accent/15 text-accent" },
    expired: { text: "Expired", cls: "bg-danger/12 text-danger" },
  } as const;
  const s = map[status] ?? map.issued;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
      {s.text}
    </span>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Download, Users, CalendarDays, Star, Gamepad2, Activity } from "lucide-react";
import { business } from "@/lib/content";

type Lead = { id: string; phone: string; table: string; venue: string; createdAt: string };
type Data = { stats: { total: number; today: number }; leads: Lead[] };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminClient() {
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [data, setData] = useState<Data | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/wifi/admin/leads");
    if (res.status === 200) {
      setData((await res.json()) as Data);
      setState("ready");
    } else {
      setState("login");
    }
  }, []);

  useEffect(() => {
    // Wrapped so no setState runs synchronously in the effect body.
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
            {business.name} · Admin
          </h1>
          <p className="mt-1 text-[13px] text-ink-dim">
            Enter the admin password to view WiFi sign-ups.
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

  const stats = data?.stats ?? { total: 0, today: 0 };
  const leads = data?.leads ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Sign-ups</h1>
          <p className="text-[13px] text-ink-dim">{business.name} · WiFi leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/overview"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Activity size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            Live
          </Link>
          <Link
            href="/admin/play"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Gamepad2 size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            Play &amp; Win
          </Link>
          <Link
            href="/admin/reviews"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Star size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            Reviews
          </Link>
          <a
            href="/api/wifi/admin/leads?format=csv"
            className="row flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium"
          >
            <Download size={15} strokeWidth={1.75} className="text-accent" aria-hidden />
            CSV
          </a>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat icon={<CalendarDays size={16} />} label="Today" value={stats.today} />
        <Stat icon={<Users size={16} />} label="Total" value={stats.total} />
      </div>

      <div className="glass mt-6 flex-1 overflow-hidden rounded-2xl">
        {leads.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-ink-dim">
            No sign-ups yet.
          </p>
        ) : (
          <ul>
            {leads.map((lead, i) => (
              <li
                key={lead.id}
                className="flex items-center justify-between px-5 py-3.5"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-medium tabular-nums">
                    {lead.phone}
                  </span>
                  {lead.table && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      Table {lead.table}
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-ink-dim">{fmtTime(lead.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </p>
    </div>
  );
}

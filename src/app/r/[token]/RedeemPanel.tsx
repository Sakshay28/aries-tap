"use client";

// The staff redemption card. Shows the reward + live status and, for a signed-in
// staff member, a one-tap "Mark as redeemed". Redemption is single-use and
// enforced server-side, so tapping twice (or scanning a screenshot again) simply
// reports "already redeemed".

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, CircleSlash, Clock, Loader2 } from "lucide-react";
import { iconFor } from "@/components/play/icons";
import type { ClaimStatus } from "@/lib/playwin/types";

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RedeemPanel(props: {
  token: string;
  isAdmin: boolean;
  reward: { title: string; description: string; icon: string; color: string; terms?: string };
  couponCode: string;
  table: string;
  status: ClaimStatus;
  redeemedAt: string | null;
  redeemedBy: string;
  expiresAt: string;
  createdAt: string;
}) {
  const [status, setStatus] = useState<ClaimStatus>(props.status);
  const [redeemedAt, setRedeemedAt] = useState(props.redeemedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needAuth, setNeedAuth] = useState(false);

  const Icon = iconFor(props.reward.icon);

  async function redeem() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNeedAuth(false);
    try {
      const res = await fetch("/api/play/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: ClaimStatus;
        redeemedAt?: string | null;
        needAuth?: boolean;
        error?: string;
      };
      if (res.status === 401 && data.needAuth) {
        setNeedAuth(true);
        return;
      }
      if (data.status) setStatus(data.status);
      if (data.redeemedAt) setRedeemedAt(data.redeemedAt);
      if (!data.ok && data.error) setError(data.error);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const badge =
    status === "redeemed"
      ? { text: "Redeemed", cls: "text-accent bg-accent/12", Icon: BadgeCheck }
      : status === "expired"
        ? { text: "Expired", cls: "text-danger bg-danger/12", Icon: CircleSlash }
        : { text: "Valid — not yet redeemed", cls: "text-ink bg-[var(--press)]", Icon: Clock };

  return (
    <div className="glass card-in relative overflow-hidden rounded-3xl p-7">
      <div className="bord" aria-hidden />

      <div className="flex items-center gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${props.reward.color}22`, color: props.reward.color }}
        >
          <Icon size={26} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{props.reward.title}</h1>
          {props.reward.description && (
            <p className="truncate text-[13px] text-ink-dim">{props.reward.description}</p>
          )}
        </div>
      </div>

      <div className={`mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${badge.cls}`}>
        <badge.Icon size={14} strokeWidth={2} aria-hidden />
        {badge.text}
        {status === "redeemed" && redeemedAt ? ` · ${fmt(redeemedAt)}` : ""}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
        <Info label="Code" value={props.couponCode} mono />
        {props.table && <Info label="Table" value={props.table} />}
        <Info label="Valid till" value={fmt(props.expiresAt)} />
      </dl>

      {props.reward.terms && (
        <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">{props.reward.terms}</p>
      )}

      {status === "issued" && (
        <>
          <button
            type="button"
            onClick={redeem}
            disabled={busy}
            className="row mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="spin" aria-hidden /> : <Check size={18} strokeWidth={2.25} aria-hidden />}
            Mark as redeemed
          </button>
          {needAuth && (
            <p className="mt-3 text-center text-[13px] text-ink-dim">
              Staff:{" "}
              <Link href="/admin" className="text-accent underline">
                sign in
              </Link>{" "}
              to redeem this reward.
            </p>
          )}
          {error && <p className="mt-3 text-center text-[13px] text-danger">{error}</p>}
        </>
      )}

      {status === "redeemed" && (
        <p className="mt-6 text-center text-[13px] text-ink-dim">
          This reward has been redeemed and can&apos;t be used again.
        </p>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 text-ink ${mono ? "font-mono tracking-[0.04em]" : ""}`}>{value}</dd>
    </div>
  );
}

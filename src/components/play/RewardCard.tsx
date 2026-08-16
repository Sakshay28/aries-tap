"use client";

// The keeper card — shown after a reward is claimed. It carries the signed QR the
// venue scans, the human-readable coupon code (fallback if a scan fails), the
// expiry, and share actions. The QR encodes a single-use, staff-validated redeem
// URL; sharing uses the venue's play link instead, so a shared screenshot can
// invite a friend but never redeem someone else's prize.

import { useState } from "react";
import { Check, Clock, Copy, Share2 } from "lucide-react";
import { business } from "@/lib/content";
import { iconFor } from "./icons";
import type { ClaimView } from "@/lib/playwin/types";

function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `Valid for ${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Valid for ${days} day${days === 1 ? "" : "s"}`;
}

export function RewardCard({ claim, terms }: { claim: ClaimView; terms: string }) {
  const [copied, setCopied] = useState(false);
  const reward = claim.reward;
  const Icon = iconFor(reward.icon);

  const playUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play` : "/play";
  const shareText = `I just won ${reward.title} at ${business.name}! 🎁 Tap to play & win:`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(claim.couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  }

  async function share() {
    const data = { title: `${business.name} · Play & Win`, text: shareText, url: playUrl };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      /* user dismissed — fall through to WhatsApp */
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${playUrl}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="pw-reward-in flex flex-col items-center text-center">
      <span
        className="pw-reward-badge flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: `${reward.color}22`, color: reward.color }}
      >
        <Icon size={30} strokeWidth={1.75} aria-hidden />
      </span>

      <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">
        Reward unlocked
      </p>
      <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">{reward.title}</h2>
      <p className="mt-1 text-[14px] text-ink-dim">{reward.description}</p>

      {/* The scannable QR on its own white tile so it reads in any theme. */}
      <div className="pw-qr-tile mt-6" aria-label="Reward QR code">
        <div className="pw-qr" dangerouslySetInnerHTML={{ __html: claim.qrSvg }} />
      </div>

      <button
        type="button"
        onClick={copyCode}
        className="row mt-4 flex items-center gap-2 rounded-full border border-line px-4 py-2 font-mono text-[15px] font-semibold tracking-[0.06em]"
      >
        {copied ? <Check size={15} className="text-accent" aria-hidden /> : <Copy size={15} className="text-ink-dim" aria-hidden />}
        {claim.couponCode}
      </button>

      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-dim">
        <Clock size={13} strokeWidth={1.75} aria-hidden />
        {expiryLabel(claim.expiresAt)}
      </p>

      <button
        type="button"
        onClick={share}
        className="row mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg"
      >
        <Share2 size={17} strokeWidth={2} aria-hidden />
        Share with a friend
      </button>

      <p className="mt-5 max-w-xs text-[11px] leading-relaxed text-ink-faint">
        Show this to your server to redeem — it can be claimed once.
        {reward.terms ? ` ${reward.terms}` : ""} {terms}
      </p>
    </div>
  );
}

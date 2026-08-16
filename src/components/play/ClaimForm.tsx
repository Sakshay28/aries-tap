"use client";

// The claim form — where the reward becomes a lead. Phone is the one required
// field (normalized to E.164 server-side); WhatsApp / birthday / email / the
// marketing opt-in are all optional lifts. Client validation is for feel; the
// server re-validates and is the authority.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ClaimResult, ClaimView, PublicReward } from "@/lib/playwin/types";

const TEN_DIGITS = /^\d{10}$/;

export function ClaimForm({
  reward,
  consentText,
  onSubmit,
  onClaimed,
}: {
  reward: PublicReward;
  consentText: string;
  onSubmit: (fields: {
    name: string;
    phone: string;
    whatsapp: string;
    birthday: string;
    email: string;
    marketingConsent: boolean;
  }) => Promise<ClaimResult>;
  onClaimed: (view: ClaimView) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [waSame, setWaSame] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneValid = TEN_DIGITS.test(phone.replace(/\D/g, ""));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!phoneValid) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await onSubmit({
      name: name.trim(),
      phone: phone.replace(/\D/g, ""),
      whatsapp: (waSame ? phone : whatsapp).replace(/\D/g, ""),
      birthday,
      email: email.trim(),
      marketingConsent: consent,
    });
    setBusy(false);
    if (res.ok) {
      onClaimed(res.claim);
    } else {
      setError(res.error || "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">
        You won {reward.title}
      </p>
      <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">Claim your reward</h2>
      <p className="mt-1 text-[13px] text-ink-dim">
        Pop in your number and we&apos;ll unlock the QR to show your server.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Field label="Name (optional)">
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="pw-input"
          />
        </Field>

        <Field label="Mobile number">
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-2xl border border-r-0 border-line bg-[var(--press)] px-3 text-[15px] text-ink-dim">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
              placeholder="98200 00000"
              className="pw-input rounded-l-none"
              required
            />
          </div>
        </Field>

        <label className="flex items-center gap-2.5 py-0.5 text-[13px] text-ink-dim">
          <input
            type="checkbox"
            className="consent-box"
            checked={waSame}
            onChange={(e) => setWaSame(e.target.checked)}
          />
          WhatsApp is the same number
        </label>

        {!waSame && (
          <Field label="WhatsApp number">
            <input
              type="tel"
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
              placeholder="WhatsApp number"
              className="pw-input"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Birthday (optional)">
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="pw-input"
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="pw-input"
            />
          </Field>
        </div>

        <label className="mt-1 flex items-start gap-2.5 text-[13px] text-ink-dim">
          <input
            type="checkbox"
            className="consent-box mt-0.5"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{consentText}</span>
        </label>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy || !phoneValid}
        className="row mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-bg disabled:opacity-40"
      >
        {busy ? <Loader2 size={18} className="spin" aria-hidden /> : "Unlock my reward"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhotoUpload, type Photo } from "./PhotoUpload";

// Screen 2B — the private branch for a guest rating below the Google threshold.
// This is where an unhappy visit is caught before it reaches a public review:
// an apology, a big honest textarea, optional photos, and an optional callback.
// Nothing here ever links to Google.

export type FeedbackFormData = {
  feedback: string;
  photos: string[];
  name: string;
  phone: string;
  email: string;
  contactRequested: boolean;
};

// Small, cheap positivity sniff for Smart Review Recovery — enough to notice a
// "food was amazing but service was slow" and gently plant the idea of a public
// review once we've made it right.
const POSITIVE = ["amazing", "great", "love", "loved", "delicious", "excellent", "best", "wonderful", "fantastic", "good", "beautiful", "perfect", "friendly"];
function soundsPositive(text: string): boolean {
  const t = text.toLowerCase();
  return t.length > 12 && POSITIVE.some((w) => t.includes(w));
}

export function PrivateFeedback({
  initialFeedback = "",
  imageUploads,
  maxImages,
  smartRecovery,
  submitting,
  error,
  onStart,
  onRecoveryShown,
  onSubmit,
}: {
  initialFeedback?: string;
  imageUploads: boolean;
  maxImages: number;
  smartRecovery: boolean;
  submitting: boolean;
  error: string;
  onStart: () => void;
  onRecoveryShown: () => void;
  onSubmit: (data: FeedbackFormData) => void;
}) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [contactRequested, setContactRequested] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const started = useRef(false);
  const recoveryFired = useRef(false);

  const showRecovery = useMemo(
    () => smartRecovery && soundsPositive(feedback),
    [smartRecovery, feedback]
  );
  // Emit the recovery event once, the first time the offer becomes visible.
  useEffect(() => {
    if (showRecovery && !recoveryFired.current) {
      recoveryFired.current = true;
      onRecoveryShown();
    }
  }, [showRecovery, onRecoveryShown]);

  function onFeedbackChange(v: string) {
    if (!started.current && v.trim()) {
      started.current = true;
      onStart();
    }
    setFeedback(v.slice(0, 4000));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    onSubmit({
      feedback: feedback.trim(),
      photos: photos.map((p) => p.dataUrl),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      contactRequested,
    });
  }

  return (
    <form onSubmit={submit} className="step-in">
      <div className="text-center">
        <span className="pop-in inline-grid h-14 w-14 place-items-center rounded-full bg-[#b89b5e]/12 text-[26px]">
          🙏
        </span>
        <h2 className="mt-4 text-[21px] font-semibold tracking-[-0.02em] text-[#1a1712]">
          We&rsquo;re sorry your experience wasn&rsquo;t perfect
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#6a6459]">
          We&rsquo;d love to make things right. This goes straight to management —
          never public.
        </p>
      </div>

      <div className="mt-6">
        <label htmlFor="rv-feedback" className="sr-only">
          Tell us what happened
        </label>
        <textarea
          id="rv-feedback"
          autoFocus
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          placeholder="Food, service, ambience or anything you'd like us to know…"
          rows={4}
          className={cn(
            "w-full resize-none rounded-2xl border border-[rgba(26,23,18,0.12)] bg-[#faf8f5] px-4 py-3.5",
            "text-[14.5px] leading-relaxed text-[#1a1712] outline-none transition-colors",
            "placeholder:text-[#a7a093] focus:border-[#b89b5e] focus:bg-white"
          )}
        />
      </div>

      {showRecovery && (
        <div className="pop-in mt-3 rounded-2xl border border-[#b89b5e]/25 bg-[#b89b5e]/[0.06] px-4 py-3">
          <p className="text-[13px] leading-relaxed text-[#6a6459]">
            <span className="font-semibold text-[#8a6d39]">Sounds like some things
            went right, too.</span>{" "}
            Once we&rsquo;ve fixed this, would you consider a public review? No
            pressure — we&rsquo;ll earn it first.
          </p>
        </div>
      )}

      {imageUploads && (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-medium text-[#6a6459]">
            Add photos <span className="text-[#a7a093]">(optional)</span>
          </p>
          <PhotoUpload photos={photos} onChange={setPhotos} max={maxImages} disabled={submitting} />
        </div>
      )}

      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-[rgba(26,23,18,0.2)] accent-[#b89b5e]"
          checked={contactRequested}
          onChange={(e) => setContactRequested(e.target.checked)}
        />
        <span className="text-[13px] leading-relaxed text-[#6a6459]">
          I&rsquo;d like someone from the restaurant to contact me.
        </span>
      </label>

      {contactRequested && (
        <div className="step-in mt-4 space-y-2.5">
          <Field label="Name" value={name} onChange={setName} autoComplete="name" placeholder="Your name" />
          <Field label="Phone" value={phone} onChange={setPhone} autoComplete="tel" type="tel" inputMode="tel" placeholder="Phone number" />
          <Field label="Email" value={email} onChange={setEmail} autoComplete="email" type="email" inputMode="email" placeholder="you@example.com" />
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "row mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b89b5e] hover:bg-[#a6894b] py-3.5",
          "text-[15px] font-semibold text-white transition-all disabled:opacity-50 shadow-sm"
        )}
      >
        {submitting ? (
          <Loader2 size={18} className="spin" aria-hidden />
        ) : (
          <>
            <Send size={16} strokeWidth={2} aria-hidden />
            Send Feedback
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-2xl border border-[rgba(26,23,18,0.12)] bg-[#faf8f5] px-4 py-3",
          "text-[14.5px] text-[#1a1712] outline-none transition-colors",
          "placeholder:text-[#a7a093] focus:border-[#b89b5e] focus:bg-white"
        )}
      />
    </label>
  );
}

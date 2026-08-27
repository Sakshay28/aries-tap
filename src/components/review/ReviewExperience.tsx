"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Copy, ExternalLink, Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitFeedback } from "@/lib/review/actions";
import type { Rating, ReviewEventName } from "@/lib/review/types";
import { Confetti } from "./Confetti";
import { OPEN_REVIEW_EVENT } from "./events";
import { PrivateFeedback, type FeedbackFormData } from "./PrivateFeedback";
import { StarRating } from "./StarRating";
import { getDeviceId, getTable, newSessionId } from "./session";
import { flushQueue, track } from "./track";

type Screen = "rate" | "google" | "googleDone" | "feedback" | "sent";
const EXIT_MS = 260;

type Settings = {
  googleUrl: string;
  googleThreshold: number;
  privateFeedback: boolean;
  imageUploads: boolean;
  maxImages: number;
  successMessage: string;
  smartRecovery: boolean;
};

export function ReviewExperience({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [screen, setScreen] = useState<Screen>("rate");
  const [rating, setRating] = useState<Rating | 0>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState(false);

  // Per-visit identity + timing, kept in refs so they never trigger renders.
  const sessionId = useRef("");
  const deviceId = useRef("");
  const table = useRef("");
  const openedAt = useRef(0);
  const completed = useRef(false);
  const returnedTracked = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const emit = useCallback(
    (name: ReviewEventName, extra?: Record<string, string | number | boolean>) => {
      void track({
        sessionId: sessionId.current,
        name,
        rating: rating || undefined,
        meta: { table: table.current, ...extra },
      });
    },
    [rating]
  );

  // ————————————————————————————————— open / close

  const openModal = useCallback(() => {
    deviceId.current = getDeviceId();
    sessionId.current = newSessionId();
    table.current = getTable();
    openedAt.current = Date.now();
    completed.current = false;
    returnedTracked.current = false;
    setRating(0);
    setComment("");
    setError("");
    setConfetti(false);
    setScreen("rate");
    setClosing(false);
    setOpen(true);
    void track({
      sessionId: sessionId.current,
      name: "opened",
      meta: { table: table.current, visitor: deviceId.current },
    });
    void flushQueue();
  }, []);

  const finishClose = useCallback(() => {
    setOpen(false);
    setClosing(false);
  }, []);

  const closeModal = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!completed.current && !opts?.silent) {
        void track({
          sessionId: sessionId.current,
          name: "cancelled",
          rating: rating || undefined,
          meta: { table: table.current, screen, timeMs: Date.now() - openedAt.current },
        });
      }
      setClosing(true);
      exitTimer.current = setTimeout(finishClose, EXIT_MS);
    },
    [finishClose, rating, screen]
  );

  // ————————————————————————————————— listeners

  useEffect(() => {
    const onOpen = () => openModal();
    window.addEventListener(OPEN_REVIEW_EVENT, onOpen);
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    void flushQueue();
    return () => {
      window.removeEventListener(OPEN_REVIEW_EVENT, onOpen);
      window.removeEventListener("online", onOnline);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [openModal]);

  // Lock the page scroll while the modal owns the screen.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the sheet when it opens (a11y).
  useEffect(() => {
    if (open && !closing) {
      const t = setTimeout(() => sheetRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open, closing]);

  // When the guest tabs back from the Google tab, record the return once.
  useEffect(() => {
    if (screen !== "googleDone") return;
    const onFocus = () => {
      if (!returnedTracked.current) {
        returnedTracked.current = true;
        emit("google_returned");
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [screen, emit]);

  // ————————————————————————————————— flow

  function onProceedFromRate() {
    if (!rating) return;
    void track({
      sessionId: sessionId.current,
      name: "rating_selected",
      rating,
      meta: { table: table.current, hasComment: Boolean(comment.trim()) },
    });
    const goPrivate = !settings.privateFeedback ? false : rating < settings.googleThreshold;
    setScreen(goPrivate ? "feedback" : "google");
  }

  function onGoogle() {
    if (comment.trim() && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        void navigator.clipboard.writeText(comment.trim());
      } catch {
        // clipboard write fallback
      }
    }
    window.open(settings.googleUrl, "_blank", "noopener,noreferrer");
    emit("google_clicked");
    completed.current = true;
    setConfetti(true);
    setScreen("googleDone");
  }

  function onMaybeLater() {
    emit("maybe_later");
    completed.current = true; // an explicit choice, not an abandonment
    closeModal({ silent: true });
  }

  async function onSubmit(data: FeedbackFormData) {
    setError("");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You appear to be offline. Reconnect and we'll send your feedback.");
      return;
    }
    setSubmitting(true);
    const res = await submitFeedback({
      sessionId: sessionId.current,
      deviceId: deviceId.current,
      rating: rating || 1,
      feedback: data.feedback,
      images: data.photos,
      name: data.name,
      phone: data.phone,
      email: data.email,
      contactRequested: data.contactRequested,
      table: table.current,
      timeMs: Date.now() - openedAt.current,
    });
    setSubmitting(false);
    if (res.ok) {
      completed.current = true;
      setScreen("sent");
    } else {
      setError(res.error);
    }
  }

  // ————————————————————————————————— keyboard trap

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !submitting) {
      e.stopPropagation();
      closeModal();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const list = Array.from(focusables).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open && !closing) return null;

  const centered = screen !== "feedback";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-md transition-opacity duration-260",
        closing ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      onKeyDown={onKeyDown}
    >
      {/* Backdrop — tap to dismiss */}
      <button
        type="button"
        aria-label="Close review"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => !submitting && closeModal()}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tap to Rate Us"
        tabIndex={-1}
        className={cn(
          "rv-sheet relative z-10 flex w-full max-w-[440px] flex-col overflow-hidden bg-white text-[#1a1712] border border-[rgba(26,23,18,0.08)] shadow-[0_25px_70px_rgba(0,0,0,0.18)] outline-none transition-all",
          "h-svh rounded-none sm:h-auto sm:max-h-[92svh] sm:rounded-3xl",
          closing && "rv-sheet-out"
        )}
      >
        {confetti && <Confetti fire={confetti} />}

        {/* Close button */}
        <button
          type="button"
          onClick={() => !submitting && closeModal()}
          aria-label="Close"
          className="absolute right-3.5 top-[max(0.875rem,env(safe-area-inset-top))] z-20 grid h-9 w-9 place-items-center rounded-full text-[#6a6459] hover:text-[#1a1712] hover:bg-[rgba(26,23,18,0.05)] transition-colors"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>

        <div
          className={cn(
            "relative flex flex-1 flex-col overflow-y-auto px-6",
            "pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))] pb-[max(1.75rem,env(safe-area-inset-bottom))]",
            centered && "justify-center"
          )}
        >
          {screen === "rate" && (
            <RateScreen
              rating={rating}
              comment={comment}
              onRatingChange={(r) => setRating(r)}
              onCommentChange={setComment}
              onProceed={onProceedFromRate}
            />
          )}

          {screen === "google" && (
            <GoogleScreen
              googleUrl={settings.googleUrl}
              comment={comment}
              onGoogle={onGoogle}
              onMaybeLater={onMaybeLater}
            />
          )}

          {screen === "googleDone" && <GoogleDoneScreen onDone={() => closeModal({ silent: true })} />}

          {screen === "feedback" && (
            <PrivateFeedback
              initialFeedback={comment}
              imageUploads={settings.imageUploads}
              maxImages={settings.maxImages}
              smartRecovery={settings.smartRecovery}
              submitting={submitting}
              error={error}
              onStart={() => emit("feedback_started")}
              onRecoveryShown={() => emit("recovery_shown")}
              onSubmit={onSubmit}
            />
          )}

          {screen === "sent" && (
            <SentScreen message={settings.successMessage} onDone={() => closeModal({ silent: true })} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ————————————————————————————————— screens

function RateScreen({
  rating,
  comment,
  onRatingChange,
  onCommentChange,
  onProceed,
}: {
  rating: Rating | 0;
  comment: string;
  onRatingChange: (r: Rating) => void;
  onCommentChange: (c: string) => void;
  onProceed: () => void;
}) {
  return (
    <div className="step-in text-center">
      <h2 className="text-balance text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[#1a1712]">
        How was your experience today?
      </h2>
      <p className="mx-auto mt-1.5 max-w-[19rem] text-[13.5px] leading-relaxed text-[#6a6459]">
        Your feedback helps us improve every visit.
      </p>

      <div className="mt-6">
        <StarRating value={rating} onChange={onRatingChange} />
      </div>

      <div className="mt-4 w-full text-left">
        <label htmlFor="rv-rate-comment" className="mb-1.5 block text-[12px] font-medium text-[#6a6459]">
          Write a comment <span className="font-normal text-[#a7a093]">(optional)</span>
        </label>
        <textarea
          id="rv-rate-comment"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Tell us about your food, drinks, or experience…"
          rows={3}
          className={cn(
            "w-full resize-none rounded-2xl border border-[rgba(26,23,18,0.12)] bg-[#faf8f5] px-4 py-3",
            "text-[14px] leading-relaxed text-[#1a1712] outline-none transition-colors",
            "placeholder:text-[#a7a093] focus:border-[#b89b5e] focus:bg-white"
          )}
        />
      </div>

      <button
        type="button"
        disabled={!rating}
        onClick={onProceed}
        className={cn(
          "row mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b89b5e] hover:bg-[#a6894b] py-3.5",
          "text-[15px] font-semibold text-white transition-all shadow-sm",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <span>Continue</span>
        <ArrowRight size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

function GoogleScreen({
  googleUrl,
  comment,
  onGoogle,
  onMaybeLater,
}: {
  googleUrl: string;
  comment: string;
  onGoogle: () => void;
  onMaybeLater: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyComment() {
    if (comment.trim() && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(comment.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="step-in text-center">
      <span className="pop-in inline-grid h-15 w-15 place-items-center rounded-full bg-[#b89b5e]/12 text-[32px]">
        🎉
      </span>
      <h2 className="mt-4 text-[23px] font-semibold tracking-[-0.02em] text-[#1a1712]">Thank you!</h2>
      <p className="mx-auto mt-1.5 max-w-[20rem] text-[14px] leading-relaxed text-[#6a6459]">
        We&rsquo;re so happy you enjoyed your visit. Would you take 30 seconds to leave us a Google review?
      </p>

      {comment.trim() && (
        <div className="mt-4 rounded-2xl border border-[rgba(26,23,18,0.08)] bg-[#faf8f5] p-3.5 text-left">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8a6d39]">Your Comment</span>
            <button
              type="button"
              onClick={copyComment}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b89b5e] hover:text-[#8a6d39] transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copied ? "Copied!" : "Copy note"}</span>
            </button>
          </div>
          <p className="text-[13px] text-[#1a1712] italic leading-snug line-clamp-3">&ldquo;{comment.trim()}&rdquo;</p>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onGoogle}
          className="row flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b89b5e] hover:bg-[#a6894b] py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all no-underline select-none cursor-pointer"
        >
          <ExternalLink size={16} strokeWidth={2} aria-hidden />
          Leave Google Review
        </a>
        <button
          type="button"
          onClick={onMaybeLater}
          className="row flex h-11 w-full items-center justify-center rounded-2xl border border-[rgba(26,23,18,0.12)] text-[14px] font-medium text-[#6a6459] hover:text-[#1a1712] hover:bg-[rgba(26,23,18,0.03)] transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function GoogleDoneScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="step-in text-center">
      <span className="pop-in inline-grid h-15 w-15 place-items-center rounded-full bg-[#b89b5e]/12 text-[32px]">
        ✨
      </span>
      <h2 className="mt-4 text-[23px] font-semibold tracking-[-0.02em] text-[#1a1712]">You&rsquo;re the best</h2>
      <p className="mx-auto mt-1.5 max-w-[20rem] text-[14px] leading-relaxed text-[#6a6459]">
        Thank you for the kind words — it genuinely makes our day. See you again soon.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="row mt-7 flex h-11 w-full items-center justify-center rounded-2xl border border-[rgba(26,23,18,0.12)] text-[14px] font-medium text-[#1a1712] hover:bg-[rgba(26,23,18,0.03)] transition-colors"
      >
        Done
      </button>
    </div>
  );
}

function SentScreen({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="step-in text-center">
      <span className="pop-in inline-grid h-15 w-15 place-items-center rounded-full bg-[#b89b5e]/12 text-[#b89b5e]">
        <Heart size={28} strokeWidth={1.75} fill="currentColor" aria-hidden />
      </span>
      <h2 className="mt-4 text-[23px] font-semibold tracking-[-0.02em] text-[#1a1712]">Thank you</h2>
      <p className="mx-auto mt-1.5 max-w-[21rem] text-[14px] leading-relaxed text-[#6a6459]">
        {message}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="row mt-7 flex h-11 w-full items-center justify-center rounded-2xl border border-[rgba(26,23,18,0.12)] text-[14px] font-medium text-[#1a1712] hover:bg-[rgba(26,23,18,0.03)] transition-colors"
      >
        Done
      </button>
    </div>
  );
}

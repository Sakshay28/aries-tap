"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Wifi,
  Loader2,
  Check,
  Copy,
  QrCode,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { business } from "@/lib/content";
import { Turnstile, turnstileConfigured } from "@/components/Turnstile";

type Step = "phone" | "code" | "done";

const RESEND_SECONDS = 60;

// Small helper: POST JSON and return {status, data}.
async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data } as {
    status: number;
    data: Record<string, unknown>;
  };
}

export function WifiFlow() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [resendIn, setResendIn] = useState(0);
  const [tsToken, setTsToken] = useState("");
  const [creds, setCreds] = useState<{ ssid: string; password: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const phoneValid = /^[6-9]\d{9}$/.test(phone);

  // ————————————————————————————————— actions

  const sendCode = useCallback(async () => {
    if (!phoneValid || !consent || loading) return;
    setLoading(true);
    setError("");
    const { status, data } = await postJson("/api/wifi/otp/start", {
      phone,
      turnstileToken: tsToken || undefined, // optional; only when configured
    });
    setLoading(false);
    if (status === 200) {
      setDevCode(data.devCode as string | undefined);
      setResendIn((data.resendIn as number) ?? RESEND_SECONDS);
      setStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 60);
    } else {
      setError((data.error as string) || "Something went wrong.");
    }
  }, [phone, phoneValid, consent, loading, tsToken]);

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== 6 || loading) return;
      setLoading(true);
      setError("");
      const { status, data } = await postJson("/api/wifi/otp/verify", {
        phone,
        code: value,
        consent,
      });
      if (status === 200) {
        const credRes = await fetch("/api/wifi/credentials");
        const cred = (await credRes.json()) as { ssid: string; password: string };
        setCreds(cred);
        setStep("done");
      } else {
        setError((data.error as string) || "Incorrect code.");
        setCode(Array(6).fill(""));
        setTimeout(() => codeRefs.current[0]?.focus(), 40);
      }
      setLoading(false);
    },
    [phone, consent, loading]
  );

  // Build the auto-join QR once we have credentials.
  useEffect(() => {
    if (!creds) return;
    const payload = `WIFI:T:WPA;S:${creds.ssid};P:${creds.password};;`;
    import("qrcode").then((m) =>
      m
        .toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: "M" })
        .then(setQr)
        .catch(() => setQr(null))
    );
  }, [creds]);

  // ————————————————————————————————— code inputs

  function setDigit(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < 5) codeRefs.current[i + 1]?.focus();
    // Verify the moment all six are present — from the event, not an effect.
    const joined = next.join("");
    if (joined.length === 6) verify(joined);
  }

  function onCodeKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  }

  function onCodePaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setCode(next);
    codeRefs.current[Math.min(digits.length, 5)]?.focus();
    if (digits.length === 6) verify(next.join(""));
  }

  const maskedPhone = useMemo(
    () => (phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : ""),
    [phone]
  );

  // ————————————————————————————————— render

  if (step === "done" && creds) {
    return <RevealStep creds={creds} qr={qr} />;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
          <Wifi size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">
            {step === "phone" ? "Connect to WiFi" : "Enter your code"}
          </h1>
          <p className="text-[13px] text-ink-dim">
            {step === "phone"
              ? "Verify your number to get the password"
              : `Sent via WhatsApp to ${maskedPhone}`}
          </p>
        </div>
      </div>

      {step === "phone" ? (
        <form
          key="phone"
          className="step-in mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <label className="block text-[12px] font-medium text-ink-dim">
            Mobile number
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-[var(--press)] px-4 py-3.5 focus-within:border-accent">
            <span className="text-[16px] font-medium text-ink-dim">+91</span>
            <div className="h-5 w-px bg-line" aria-hidden />
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              placeholder="98200 00000"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full bg-transparent text-[16px] font-medium tracking-wide text-ink outline-none placeholder:text-ink-faint"
            />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="consent-box mt-0.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-[12px] leading-relaxed text-ink-dim">
              I agree to receive a verification message and occasional offers from{" "}
              {business.name}.{" "}
              <a
                href={business.privacyUrl}
                className="text-accent underline underline-offset-2"
              >
                Privacy
              </a>
            </span>
          </label>

          {turnstileConfigured && <Turnstile onToken={setTsToken} />}

          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

          <button
            type="submit"
            disabled={
              !phoneValid || !consent || loading || (turnstileConfigured && !tsToken)
            }
            className="row mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-[15px] font-semibold text-bg transition-opacity disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={18} className="spin" aria-hidden />
            ) : (
              "Send code"
            )}
          </button>
        </form>
      ) : (
        <div key="code" className="step-in mt-7">
          <div className="flex gap-2.5" onPaste={onCodePaste}>
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  codeRefs.current[i] = el;
                }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                data-filled={Boolean(d)}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onCodeKey(i, e)}
                className="otp-box"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {devCode && (
            <p className="mt-4 rounded-xl border border-line bg-[var(--press)] px-3 py-2 text-[12px] text-ink-dim">
              Dev mode — no WhatsApp configured. Code:{" "}
              <span className="font-semibold text-accent">{devCode}</span>
            </p>
          )}

          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

          <div className="mt-5 flex items-center justify-center gap-1 text-[13px]">
            {loading ? (
              <span className="flex items-center gap-2 text-ink-dim">
                <Loader2 size={15} className="spin" aria-hidden /> Verifying…
              </span>
            ) : resendIn > 0 ? (
              <span className="text-ink-faint">Resend code in {resendIn}s</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCode(Array(6).fill(""));
                  sendCode();
                }}
                className="font-medium text-accent"
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ————————————————————————————————— reveal step

function RevealStep({
  creds,
  qr,
}: {
  creds: { ssid: string; password: string };
  qr: string | null;
}) {
  const [copied, setCopied] = useState<"ssid" | "password" | null>(null);

  async function copy(which: "ssid" | "password", value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard may be blocked; the value is on screen regardless */
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="step-in">
      <div className="flex flex-col items-center text-center">
        <span className="pop-in flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <ShieldCheck size={28} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">
          You&rsquo;re verified
        </h1>
        <p className="mt-1 text-[13px] text-ink-dim">
          Here&rsquo;s the WiFi — you&rsquo;re all set.
        </p>
      </div>

      <div className="mt-6 space-y-2.5">
        <CredRow
          label="Network"
          value={creds.ssid}
          copied={copied === "ssid"}
          onCopy={() => copy("ssid", creds.ssid)}
        />
        <CredRow
          label="Password"
          value={creds.password}
          copied={copied === "password"}
          onCopy={() => copy("password", creds.password)}
        />
      </div>

      {qr && (
        <div className="mt-6 flex flex-col items-center">
          <div className="rounded-2xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Scan to join WiFi" width={150} height={150} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-dim">
            <QrCode size={13} strokeWidth={1.75} aria-hidden />
            Scan with your camera to join automatically
          </p>
        </div>
      )}

      <a
        href={`https://wa.me/?text=${encodeURIComponent(
          `${business.name} WiFi — ${creds.ssid} / ${creds.password}`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="row mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-[14px] font-medium"
      >
        <MessageCircle size={17} strokeWidth={1.75} className="text-accent" aria-hidden />
        Save to WhatsApp
      </a>
    </div>
  );
}

function CredRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="row flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3.5 text-left"
    >
      <span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </span>
        <span className="mt-0.5 block text-[16px] font-semibold tracking-tight">
          {value}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-[12px] text-ink-dim">
        {copied ? (
          <>
            <Check size={15} strokeWidth={2.25} className="pop-in text-accent" aria-hidden />
            Copied
          </>
        ) : (
          <Copy size={16} strokeWidth={1.75} aria-hidden />
        )}
      </span>
    </button>
  );
}

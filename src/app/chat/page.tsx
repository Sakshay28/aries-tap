import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { business } from "@/lib/content";
import { ChatUI } from "./ChatUI";

export const metadata: Metadata = {
  title: `Ask ${business.name}`,
  robots: { index: false },
};

export default function ChatPage() {
  return (
    <div className="mx-auto flex h-svh w-full max-w-md flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 px-2 pb-3">
        <Link
          href="/"
          aria-label="Back"
          className="row flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <ArrowLeft size={20} strokeWidth={1.75} className="text-ink-dim" aria-hidden />
        </Link>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/12 text-accent">
          <Sparkles size={19} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold leading-tight tracking-[-0.01em]">
            {business.name} Host
          </h1>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5fbf7e]" aria-hidden />
            Here to help
          </p>
        </div>
      </header>

      <ChatUI />
    </div>
  );
}

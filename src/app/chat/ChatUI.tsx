"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { business } from "@/lib/content";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; content: string };

// Opening line + starter chips. Chips just send a preset message through the
// same pipeline, so the AI (or the deterministic host) answers them for real.
const GREETING = `Hi, welcome to ${business.name}! ☕\nI can recommend dishes, sort out diets or allergies, find something in your budget, or help you book a table. What are you in the mood for?`;

const CHIPS = [
  "Recommend something",
  "Vegan options",
  "Something spicy",
  "Under ₹300",
  "Book a table",
  "Call the waiter",
  "What's your best coffee?",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view as it streams.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    if (navigator.vibrate) navigator.vibrate(5);
    const userMsg: Message = { id: uid(), role: "user", content: trimmed };
    const assistantId = uid();
    const history = [...messages, userMsg];
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const update = (fn: (prev: string) => string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: fn(m.content) } : m))
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        update(() => error || "Sorry, I couldn't reach the kitchen just now. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        update((prev) => prev + chunk);
      }
    } catch {
      update((prev) => prev || "Sorry, something went wrong. Please try again.");
    } finally {
      setStreaming(false);
      taRef.current?.focus();
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const showChips = messages.length <= 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} streaming={streaming} />
        ))}
      </div>

      {/* Starter chips only before the first question. */}
      {showChips && (
        <div className="chips flex gap-2 overflow-x-auto px-2 pb-3">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => send(c)}
              className="row shrink-0 whitespace-nowrap rounded-full border border-line px-4 py-2 text-[13px] font-medium"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
      >
        <div className="glass flex flex-1 items-end rounded-3xl px-4 py-2.5">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) onSubmit(e);
            }}
            rows={1}
            placeholder="Ask me anything…"
            className="max-h-28 w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          aria-label="Send"
          className="row flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-opacity disabled:opacity-40"
        >
          <ArrowUp size={20} strokeWidth={2.25} aria-hidden />
        </button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: Role;
  content: string;
  streaming: boolean;
}) {
  const isUser = role === "user";
  // An empty assistant bubble that's still streaming shows the typing dots.
  if (!isUser && !content && streaming) {
    return (
      <div className="msg-in flex justify-start">
        <div className="glass flex items-center gap-1.5 rounded-3xl rounded-bl-lg px-4 py-3.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    );
  }
  return (
    <div className={`msg-in flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[82%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] leading-relaxed text-bg"
            : "glass max-w-[86%] whitespace-pre-wrap rounded-3xl rounded-bl-lg px-4 py-2.5 text-[15px] leading-relaxed text-ink"
        }
      >
        {content}
      </div>
    </div>
  );
}

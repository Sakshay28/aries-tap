import { NextResponse } from "next/server";
import { store } from "@/lib/wifi/store";
import { clientIp } from "@/lib/wifi/request";
import {
  GEMINI_KEY,
  GEMINI_MODEL,
  usingGemini,
  MAX_TURNS,
  MAX_MESSAGE_CHARS,
  GEN_CONFIG,
  CHAT_RULES,
} from "@/lib/chat/config";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import { fallbackReply } from "@/lib/chat/fallback";

export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };

// Rate-limit a chat turn by IP across a short and a long window.
async function limited(ip: string): Promise<boolean> {
  const a = await store.incrWithTtl(`chat:m:${ip}`, CHAT_RULES.perIpMinute.window);
  if (a > CHAT_RULES.perIpMinute.max) return true;
  const b = await store.incrWithTtl(`chat:h:${ip}`, CHAT_RULES.perIpHourly.window);
  return b > CHAT_RULES.perIpHourly.max;
}

// Plain UTF-8 text stream — the client reads it and appends tokens.
function textStream(text: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  let body: { messages?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!lastUser.trim() || lastUser.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Say a little more." }, { status: 422 });
  }

  if (await limited(clientIp(req))) {
    return NextResponse.json(
      { error: "You're chatting fast! Give me a moment." },
      { status: 429 }
    );
  }

  const system = buildSystemPrompt(new Date());

  // No key (or later, on error) → deterministic host. Never a dead endpoint.
  if (!usingGemini) return textStream(fallbackReply(lastUser));

  try {
    return await streamFromGemini(system, messages);
  } catch (err) {
    console.error("[chat] Gemini failed, using fallback", err);
    return textStream(fallbackReply(lastUser));
  }
}

// —————————————————————————————— Gemini streaming (plain fetch, house style)

async function streamFromGemini(system: string, messages: Msg[]): Promise<Response> {
  const contents = messages
    .slice(-MAX_TURNS * 2)
    .filter((m) => m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.slice(0, MAX_MESSAGE_CHARS) }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: GEN_CONFIG,
    }),
  });

  if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}`);

  // Re-stream: parse Gemini's SSE server-side, emit only the text deltas.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep the trailing partial line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const json = trimmed.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) controller.enqueue(encoder.encode(text));
        } catch {
          // Ignore a malformed partial event; the next read completes it.
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

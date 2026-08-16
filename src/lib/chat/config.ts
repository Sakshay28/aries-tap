// Hard limits and operational knobs for the AI Host. Tenant-facing personality
// lives in the prompt; this file protects the system and the wallet.

import { business } from "@/lib/content";

export const TENANT_ID = business.id;

export const GEMINI_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
export const usingGemini = Boolean(GEMINI_KEY);

// A conversation we're willing to send to the model. We keep only the last
// MAX_TURNS exchanges (the menu + persona are re-sent every call as the system
// prompt, so old turns add cost without adding grounding).
export const MAX_TURNS = 10;
export const MAX_MESSAGE_CHARS = 1000;

// Generation: warm but grounded. Low-ish temperature keeps it from wandering
// off-menu; the cap keeps replies short (the persona asks for <120 words).
export const GEN_CONFIG = {
  temperature: 0.6,
  topP: 0.9,
  maxOutputTokens: 400,
} as const;

// Abuse / cost control. Chat calls cost money, so cap per IP. Tuned to be
// invisible to a real guest (who sends a message every few seconds) and a wall
// to a script. Backed by the shared store (Upstash in prod, in-memory in dev).
export const CHAT_RULES = {
  perIpMinute: { max: 15, window: 60 },
  perIpHourly: { max: 200, window: 60 * 60 },
} as const;

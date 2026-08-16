// Turn a raw complaint into something a busy manager can triage in two seconds:
// a one-line summary, a priority, the department that owns it, a severity, the
// themes it touches, and a ready-to-send apology.
//
// Two implementations behind one signature. Gemini (via a plain authenticated
// fetch — no SDK, matching the house style) when GEMINI_API_KEY is set; a fast,
// deterministic keyword heuristic otherwise. The heuristic means this feature is
// never "off" — a venue with no AI key still gets useful triage on every row.

import type {
  AiAnalysis,
  AiCategory,
  AiPriority,
  AiSeverity,
} from "./types";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export const usingGemini = Boolean(GEMINI_KEY);

type Input = {
  rating: number;
  feedback: string;
  contactRequested: boolean;
  hasImages: boolean;
};

export async function analyzeFeedback(input: Input): Promise<AiAnalysis> {
  if (GEMINI_KEY) {
    try {
      const ai = await withTimeout(callGemini(input), 8000);
      if (ai) return ai;
    } catch (err) {
      console.error("[review-ai] Gemini failed, using heuristic", err);
    }
  }
  return heuristic(input);
}

// —————————————————————————————— Gemini

async function callGemini(input: Input): Promise<AiAnalysis | null> {
  const prompt = buildPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        maxOutputTokens: 512,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const parsed = JSON.parse(text) as Partial<AiAnalysis>;
  // Never trust the model's shape — clamp everything into our enums, and use the
  // heuristic as the source of defaults for anything missing or invalid.
  const base = heuristic(input);
  return {
    summary: str(parsed.summary, base.summary).slice(0, 240),
    priority: enumOr<AiPriority>(parsed.priority, ["low", "medium", "high"], base.priority),
    department: str(parsed.department, base.department).slice(0, 40),
    severity: enumOr<AiSeverity>(
      parsed.severity,
      ["minor", "moderate", "critical"],
      base.severity
    ),
    categories: cleanCategories(parsed.categories, base.categories),
    suggestedResponse: str(parsed.suggestedResponse, base.suggestedResponse).slice(0, 800),
    source: "gemini",
  };
}

function buildPrompt(input: Input): string {
  return [
    "You are the guest-experience manager for a premium restaurant.",
    "Analyze this private guest complaint and respond with STRICT JSON only.",
    "",
    `Rating: ${input.rating}/5`,
    `Guest wants a callback: ${input.contactRequested ? "yes" : "no"}`,
    `Photos attached: ${input.hasImages ? "yes" : "no"}`,
    `Feedback: """${input.feedback || "(no text provided)"}"""`,
    "",
    "Return exactly this JSON shape:",
    "{",
    '  "summary": "one neutral sentence a manager can scan",',
    '  "priority": "low" | "medium" | "high",',
    '  "department": "Kitchen | Service | Facilities | Bar | Management",',
    '  "severity": "minor" | "moderate" | "critical",',
    '  "categories": ["food"|"service"|"ambience"|"cleanliness"|"pricing"|"staff"|"other"],',
    '  "suggestedResponse": "a warm, specific, apologetic reply under 60 words, no placeholders"',
    "}",
  ].join("\n");
}

// —————————————————————————————— heuristic fallback

const CATEGORY_KEYWORDS: Record<AiCategory, string[]> = {
  food: ["food", "dish", "cold", "burnt", "raw", "undercooked", "stale", "taste", "flavour", "flavor", "portion", "menu", "meal", "spicy", "bland", "hair"],
  service: ["service", "slow", "wait", "waited", "late", "delay", "ignored", "forgot", "attention", "order", "served"],
  ambience: ["ambience", "ambiance", "music", "loud", "noisy", "seating", "table", "crowded", "cramped", "smell", "temperature", "cold room", "hot"],
  cleanliness: ["dirty", "unclean", "unhygienic", "hygiene", "washroom", "toilet", "restroom", "cockroach", "insect", "fly", "sticky", "mess"],
  pricing: ["price", "expensive", "overpriced", "costly", "bill", "charge", "overcharged", "money", "value", "refund"],
  staff: ["staff", "waiter", "waitress", "rude", "manager", "attitude", "behaviour", "behavior", "impolite", "unfriendly", "argued", "insulted"],
  other: [],
};

const CRITICAL_KEYWORDS = [
  "sick", "ill", "vomit", "food poisoning", "allergic", "allergy", "hair", "cockroach",
  "insect", "refund", "insulted", "racist", "abuse", "unhygienic", "hospital", "worst",
  "disgusting", "rude", "overcharged", "theft", "unsafe",
];

function heuristic(input: Input): AiAnalysis {
  const text = input.feedback.toLowerCase();

  // Categories — every keyword hit counts; fall back to "other".
  const categories: AiCategory[] = [];
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [AiCategory, string[]][]) {
    if (cat === "other") continue;
    if (words.some((w) => text.includes(w))) categories.push(cat);
  }
  if (categories.length === 0) categories.push("other");

  const hasCritical = CRITICAL_KEYWORDS.some((w) => text.includes(w));

  // Severity — critical words win; otherwise rating-driven.
  let severity: AiSeverity = "minor";
  if (hasCritical || input.rating <= 1) severity = "critical";
  else if (input.rating <= 2) severity = "moderate";
  else if (input.rating <= 3) severity = "moderate";

  // Priority — low ratings, critical themes, or a callback request escalate.
  let priority: AiPriority = "low";
  if (severity === "critical" || input.rating <= 2) priority = "high";
  else if (input.rating <= 3 || input.contactRequested) priority = "medium";

  const primary = categories[0];
  const department = DEPARTMENT[primary];

  const summary = buildSummary(input, categories, severity);
  const suggestedResponse = buildResponse(categories, input.contactRequested);

  return {
    summary,
    priority,
    department,
    severity,
    categories,
    suggestedResponse,
    source: "heuristic",
  };
}

const DEPARTMENT: Record<AiCategory, string> = {
  food: "Kitchen",
  service: "Service",
  ambience: "Facilities",
  cleanliness: "Facilities",
  pricing: "Management",
  staff: "Management",
  other: "Management",
};

const CATEGORY_PHRASE: Record<AiCategory, string> = {
  food: "the food",
  service: "the service",
  ambience: "the ambience",
  cleanliness: "cleanliness",
  pricing: "pricing",
  staff: "the staff",
  other: "their visit",
};

function buildSummary(
  input: Input,
  categories: AiCategory[],
  severity: AiSeverity
): string {
  const themes = categories.map((c) => CATEGORY_PHRASE[c]).slice(0, 2).join(" and ");
  const grade = severity === "critical" ? "a serious" : "a";
  const callback = input.contactRequested ? " Guest asked to be contacted." : "";
  if (!input.feedback.trim()) {
    return `${input.rating}★ with no written note — likely ${themes}.${callback}`.trim();
  }
  return `${input.rating}★ guest raised ${grade} concern about ${themes}.${callback}`.trim();
}

function buildResponse(categories: AiCategory[], contact: boolean): string {
  const theme = CATEGORY_PHRASE[categories[0]];
  const close = contact
    ? "We'd love to make it right — someone from the team will reach out to you personally."
    : "We'd love the chance to make it right on your next visit.";
  return `Thank you for telling us — and we're sorry we fell short on ${theme}. This isn't the experience we want any guest to have. ${close}`;
}

// —————————————————————————————— small guards

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function enumOr<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === "string" && allowed.includes(v as T) ? (v as T) : fallback;
}

function cleanCategories(v: unknown, fallback: AiCategory[]): AiCategory[] {
  const valid: AiCategory[] = ["food", "service", "ambience", "cleanliness", "pricing", "staff", "other"];
  if (!Array.isArray(v)) return fallback;
  const out = v.filter((c): c is AiCategory => valid.includes(c as AiCategory));
  return out.length ? [...new Set(out)] : fallback;
}

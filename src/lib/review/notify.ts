// Alert the venue the instant a piece of private feedback lands. Fire-and-forget
// so it never slows the guest's submission, and env-gated so it's a no-op until
// a venue wires a channel. The webhook receives a compact, already-summarized
// payload and fans it out to email now (WhatsApp / push later) — same relay
// pattern as the OTP delivery hook.

import { business } from "@/lib/content";
import type { FeedbackRow } from "./types";

const WEBHOOK = process.env.REVIEW_NOTIFY_WEBHOOK_URL;
const TOKEN = process.env.REVIEW_NOTIFY_TOKEN;

export const usingRealNotify = Boolean(WEBHOOK && TOKEN);

export async function notifyNewFeedback(row: FeedbackRow): Promise<void> {
  if (!usingRealNotify) {
    console.info(
      `[review-notify:dev] ${row.rating}★ · ${row.ai?.priority ?? "?"} priority · ${
        row.ai?.department ?? "?"
      } — ${row.ai?.summary ?? row.feedback.slice(0, 80)}`
    );
    return;
  }

  try {
    await fetch(WEBHOOK!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        venue: business.name,
        tenantId: row.tenantId,
        id: row.id,
        rating: row.rating,
        summary: row.ai?.summary ?? "",
        priority: row.ai?.priority ?? "",
        department: row.ai?.department ?? "",
        severity: row.ai?.severity ?? "",
        categories: row.ai?.categories ?? [],
        suggestedResponse: row.ai?.suggestedResponse ?? "",
        feedback: row.feedback,
        contactRequested: row.contactRequested,
        contact: row.contactRequested
          ? { name: row.name, phone: row.phone, email: row.email }
          : undefined,
        table: row.table,
        photos: row.images.length,
        createdAt: row.createdAt,
      }),
    });
  } catch (err) {
    // A failed alert must never surface to the guest — log and move on.
    console.error("[review-notify] webhook failed", err);
  }
}

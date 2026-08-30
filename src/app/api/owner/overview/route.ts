// The multi-venue owner dashboard's data plane. Behind the owner session cookie
// (not a venue admin's). For each configured venue it computes exactly the four
// metrics — taps, WiFi, reviews, chats — plus their drill-down lists, every read
// scoped to that venue's tenant id. On a shared database this is one query set
// per venue; locally it reads the same tenant-scoped JSON store.

import { NextResponse, type NextRequest } from "next/server";
import { VENUES } from "@/lib/owner/venues";
import { isOwner } from "@/lib/owner/session";
import { overviewMetrics } from "@/lib/events/db";
import { listQrCodesForTenant } from "@/lib/qr/db";
import type { TagInfo } from "@/lib/events/analytics";
import { leadStats, listLeads } from "@/lib/wifi/db";
import { prettyPhone } from "@/lib/wifi/phone";
import { computeAnalytics } from "@/lib/review/analytics";
import { listEvents, listFeedback } from "@/lib/review/db";
import { chatStats, listChatTurns } from "@/lib/chat/db";
import { logEvent } from "@/lib/events/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function venueBundle(id: string, name: string) {
  const codes = await listQrCodesForTenant(id, 500);
  const tags: TagInfo[] = codes
    .filter((c) => !c.archivedAt)
    .map((c) => ({ code: c.code, label: c.label, isActive: c.isActive }));

  const [metrics, wifiStats, leads, events, feedbackRows, chatCounts, chatTurns] =
    await Promise.all([
      overviewMetrics(id, tags),
      leadStats(id),
      listLeads(id, 200),
      listEvents(id, 8000),
      listFeedback(id, 1000),
      chatStats(id),
      listChatTurns(id, 200),
    ]);

  const analytics = computeAnalytics(events, feedbackRows);

  return {
    venue: { id, name },
    overview: {
      totalTaps: metrics.totalTaps,
      tapsToday: metrics.tapsToday,
      topTags: metrics.topTags,
    },
    wifi: {
      stats: wifiStats,
      leads: leads.map((l) => ({
        id: l.id,
        phone: prettyPhone(l.phone),
        table: l.table,
        createdAt: l.createdAt,
      })),
    },
    analytics: {
      totalRatings: analytics.totalRatings,
      averageRating: analytics.averageRating,
    },
    feedback: feedbackRows.slice(0, 150).map((f) => ({
      id: f.id,
      rating: f.rating,
      feedback: f.feedback,
      table: f.table,
      createdAt: f.createdAt,
      ai: f.ai ? { summary: f.ai.summary } : null,
    })),
    chat: {
      stats: chatCounts,
      messages: chatTurns.map((m) => ({
        id: m.id,
        table: m.table,
        question: m.question,
        answer: m.answer,
        createdAt: m.createdAt,
      })),
    },
  };
}

export async function GET(req: NextRequest) {
  if (!(await isOwner(req))) {
    logEvent("authz_failure", { route: "owner/overview" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const venues = await Promise.all(VENUES.map((v) => venueBundle(v.id, v.name)));
  return NextResponse.json({ venues }, { headers: { "Cache-Control": "no-store" } });
}

// Admin: read one QR (with history + stats), change where it points, toggle it,
// or archive it. `code` is deliberately not patchable — renaming a printed
// identifier would orphan every physical copy already in the world.

import { NextResponse, type NextRequest } from "next/server";
import { permanentUrlFor } from "@/lib/qr/config";
import { archiveQrCode, getQrById, listAudit, scanStats, updateQrCode } from "@/lib/qr/db";
import { resolveOwnerTenant } from "@/lib/events/tenant";
import { sanitizeLabel, validateDestinationUrl } from "@/lib/qr/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await resolveOwnerTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const row = await getQrById(tenant, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [stats, history] = await Promise.all([scanStats(tenant, id), listAudit(tenant, id)]);
  return NextResponse.json({
    code: { ...row, permanentUrl: permanentUrlFor(row.code) },
    stats,
    history,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await resolveOwnerTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;

  let body: { destinationUrl?: unknown; label?: unknown; isActive?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const patch: { destinationUrl?: string; label?: string; isActive?: boolean } = {};

  if (body.destinationUrl !== undefined) {
    const dest = validateDestinationUrl(body.destinationUrl);
    if (!dest.ok) return NextResponse.json({ error: dest.reason }, { status: 422 });
    patch.destinationUrl = dest.url;
  }
  if (body.label !== undefined) patch.label = sanitizeLabel(body.label);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid update." }, { status: 422 });
    }
    patch.isActive = body.isActive;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 422 });
  }

  const row = await updateQrCode(tenant, id, patch);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ code: { ...row, permanentUrl: permanentUrlFor(row.code) } });
}

// Soft-archive. There is no hard delete: a physical QR that exists in the world
// keeps its row, its history and its recoverability.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await resolveOwnerTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const row = await archiveQrCode(tenant, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ code: { ...row, permanentUrl: permanentUrlFor(row.code) } });
}

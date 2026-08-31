// Admin: list + create QR codes. Same auth posture as every other admin route
// in this app — the shared signed `aries_admin` cookie — but the tenant is
// resolved from that signed session (resolveOwnerTenant), never a build-time
// constant, so on a shared deployment an admin only ever lists and creates
// their own venue's codes.

import { NextResponse, type NextRequest } from "next/server";
import { QR_BASE_IS_LOCAL, QR_BASE_URL, permanentUrlFor } from "@/lib/qr/config";
import { DuplicateCodeError, createQrCode, listQrCodesForTenant } from "@/lib/qr/db";
import { resolveOwnerTenant } from "@/lib/events/tenant";
import { normalizeQrCode, sanitizeLabel, validateDestinationUrl } from "@/lib/qr/validation";
import { normalizeTable } from "@/lib/table/session";

export async function GET(req: NextRequest) {
  const tenant = await resolveOwnerTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await listQrCodesForTenant(tenant);
  return NextResponse.json({
    baseUrl: QR_BASE_URL,
    baseIsLocal: QR_BASE_IS_LOCAL,
    codes: rows.map((r) => ({ ...r, permanentUrl: permanentUrlFor(r.code) })),
  });
}

export async function POST(req: NextRequest) {
  const tenant = await resolveOwnerTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { code?: unknown; destinationUrl?: unknown; label?: unknown; table?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const code = normalizeQrCode(body.code);
  if (!code) {
    return NextResponse.json(
      { error: "Code must be letters and numbers, e.g. AT001." },
      { status: 422 },
    );
  }

  const dest = validateDestinationUrl(body.destinationUrl);
  if (!dest.ok) return NextResponse.json({ error: dest.reason }, { status: 422 });

  try {
    const row = await createQrCode(tenant, {
      code,
      destinationUrl: dest.url,
      label: sanitizeLabel(body.label),
      table: normalizeTable(body.table),
    });
    return NextResponse.json(
      { code: { ...row, permanentUrl: permanentUrlFor(row.code) } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof DuplicateCodeError) {
      // Never silently rebind a code that may already be printed.
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

// Print-ready artwork for a QR: /api/qr/<id>/artwork?format=svg|png
//
// Always encodes the permanent resolver URL, never the destination — the same
// code always produces byte-identical artwork, no matter how many times the
// venue has re-pointed it.

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/wifi/session";
import { ADMIN_COOKIE } from "@/lib/qr/config";
import { getQrById } from "@/lib/qr/db";
import { qrPngForCode, qrSvgForCode } from "@/lib/qr/generate";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const payload = await verifyToken<{ kind?: string }>(req.cookies.get(ADMIN_COOKIE)?.value);
  return payload?.kind === "admin";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const row = await getQrById(id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const filename = `aries-tap-${row.code}.${format}`;

  if (format === "png") {
    const buf = await qrPngForCode(row.code);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const svg = await qrSvgForCode(row.code);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Printed QR → the shared permanent resolver.
//
// The URL below is what gets physically printed and can never change; the
// destination behind it is a database column the venue edits at will. The NFC
// tag on the same card resolves through /t/[code] to the very same record —
// see lib/qr/resolve.ts for why they are one code path.

import type { NextRequest } from "next/server";
import { resolveTag } from "@/lib/qr/resolve";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return resolveTag(req, code, "qr");
}

// NFC tap → the shared permanent resolver.
//
// Same record, same table, same destination as the printed QR on the same card;
// only the medium differs. Kept as its own path rather than folded into /q/
// because an NFC tag is *written*, not printed — so distinguishing the two costs
// nothing at manufacture and answers a question an owner cannot otherwise
// answer: are guests actually tapping, or is a batch of tags unprogrammed and
// everyone quietly falling back to the QR?

import type { NextRequest } from "next/server";
import { resolveTag } from "@/lib/qr/resolve";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return resolveTag(req, code, "nfc");
}

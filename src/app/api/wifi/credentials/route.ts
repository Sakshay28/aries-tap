import { NextRequest, NextResponse } from "next/server";
import { business } from "@/lib/content";
import { verifyToken } from "@/lib/wifi/session";
import { VERIFY_COOKIE } from "@/lib/wifi/config";

// The WiFi password lives here and nowhere in the client bundle. It is returned
// only to a request carrying a valid, unexpired verification cookie — so an
// unverified visitor (or a scraped page source) never sees it.

export async function GET(req: NextRequest) {
  const token = req.cookies.get(VERIFY_COOKIE)?.value;
  const payload = await verifyToken<{ kind?: string }>(token);
  if (!payload || payload.kind !== "wifi") {
    return NextResponse.json({ error: "Not verified." }, { status: 401 });
  }

  return NextResponse.json({
    ssid: business.wifi.ssid,
    password: business.wifi.password,
  });
}

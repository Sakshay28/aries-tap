// QR artwork for a *permanent* Aries Tap resolver URL.
//
// Critically: these helpers only ever encode `${QR_BASE_URL}/q/<code>` — never
// a destination URL. That indirection is the entire feature. Encoding a
// destination directly would produce a static QR that dies the moment the venue
// changes where it points.
//
// Error correction is level H (~30% recoverable) rather than the M used for the
// on-screen Play & Win reward QR: this artwork gets physically printed, and has
// to survive ink spread, lamination, scuffing and being scanned at an angle in
// low light.

import QRCode from "qrcode";
import { permanentUrlFor } from "./config";

const RENDER = {
  errorCorrectionLevel: "H" as const,
  // 4 modules is the spec-mandated quiet zone. Anything less and scanners
  // struggle against a busy print background.
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
};

// Vector — the format to hand a printer. Scales to any physical size with no
// resampling, so the same file works on a table tent or a shopfront decal.
export function qrSvgForCode(code: string): Promise<string> {
  return QRCode.toString(permanentUrlFor(code), {
    ...RENDER,
    type: "svg",
    width: 1024,
  });
}

// Raster — for previews, slide decks and anything that can't place an SVG.
export function qrPngForCode(code: string): Promise<Buffer> {
  return QRCode.toBuffer(permanentUrlFor(code), {
    ...RENDER,
    type: "png",
    width: 1024,
  });
}

// Inline preview for the dashboard (no extra network request).
export function qrDataUrlForCode(code: string): Promise<string> {
  return QRCode.toDataURL(permanentUrlFor(code), { ...RENDER, width: 512 });
}

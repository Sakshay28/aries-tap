// Render the reward's redeem URL as an inline SVG QR. Inline (not a data-URL
// <img> or a hosted image) so it costs zero network requests, survives offline,
// and drops straight into the reward card. Dark modules on white for reliable
// scanning under any venue theme — the card gives it a white tile to sit on.

import QRCode from "qrcode";

export async function rewardQrSvg(url: string): Promise<string> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      width: 232,
      color: { dark: "#111111", light: "#ffffff" },
    });
  } catch {
    return "";
  }
}

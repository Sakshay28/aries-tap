// Branded QR artwork — the venue's colour, and the table number set into the
// middle of the code.
//
// The centre label is decoration, not data. The QR still encodes only the
// permanent resolver URL; "5A" is there so staff and guests can tell one table
// tent from another at a glance. That means the label physically covers
// modules, so everything here exists to make that safe:
//
//   • error correction H  — up to ~30% of the code can be lost and still read
//   • the label is capped at LABEL_MAX_RATIO of the QR's width, well inside
//     that budget, and always sits dead centre where damage is cheapest
//   • a quiet ring of background colour separates label from modules so the
//     decoder sees a clean island rather than smeared data
//
// Every generated code is decode-verified in the test suite; a label that would
// push a specific code past its recovery budget fails there rather than in a
// customer's hand.

import QRCode from "qrcode";

// Fraction of the QR's width the centre label may occupy. 0.18 keeps the
// obscured area near 3% of total modules — an order of magnitude inside the
// ~30% level-H budget, leaving the rest of the margin for print wear, ink
// spread and a guest's smudged camera lens.
const LABEL_MAX_RATIO = 0.18;

export type BrandedQrOptions = {
  /** The permanent resolver URL to encode. Never the destination. */
  url: string;
  /** Human-facing table/seat label drawn in the centre, e.g. "5A". */
  label?: string;
  /** Module colour. Defaults to the Taffeta coffee brown. */
  dark?: string;
  /** Background. Keep it light — contrast is what makes a code scannable. */
  light?: string;
  /** Rendered width in px (SVG viewBox is module-based; this sets the frame). */
  width?: number;
};

const DEFAULTS = {
  dark: "#4A2318",
  light: "#ffffff",
  width: 1024,
} as const;

/**
 * Print-ready SVG. Vector, so it scales to any physical size without loss —
 * this is what goes to a printer.
 */
export async function brandedQrSvg(opts: BrandedQrOptions): Promise<string> {
  const dark = opts.dark ?? DEFAULTS.dark;
  const light = opts.light ?? DEFAULTS.light;
  const label = (opts.label ?? "").trim();

  const svg = await QRCode.toString(opts.url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
    width: opts.width ?? DEFAULTS.width,
    color: { dark, light },
  });

  if (!label) return svg;

  // The generated viewBox is in module units ("0 0 N N"), which is the
  // coordinate space the overlay has to be expressed in for the label to stay
  // centred at any output size.
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!vb) return svg; // Unrecognised output: ship the plain code, never a broken one.

  const size = Number(vb[1]);
  const c = size / 2;
  const r = (size * LABEL_MAX_RATIO) / 2;

  // Font size tapers as the label gets longer so "12" and "5A" both sit inside
  // the disc instead of spilling over the modules around it.
  const fontSize = r * (label.length > 2 ? 0.85 : 1.05);

  const overlay =
    `<g>` +
    // Quiet ring: background-coloured disc slightly larger than the label,
    // giving the decoder a clean boundary instead of a hard edge against data.
    `<circle cx="${c}" cy="${c}" r="${r * 1.14}" fill="${light}"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="${dark}"/>` +
    `<text x="${c}" y="${c}" fill="${light}" font-family="Helvetica,Arial,sans-serif" ` +
    `font-size="${fontSize}" font-weight="600" text-anchor="middle" ` +
    `dominant-baseline="central">${escapeXml(label)}</text>` +
    `</g>`;

  return svg.replace("</svg>", `${overlay}</svg>`);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Print-ready Aries Tap table tent — one file per table.
//
// The whole card is generated, not just the QR, because the QR is the only
// thing that differs between tables and hand-editing 40 layouts is how a table
// ends up with the wrong code silently printed on it. Generating the full card
// means the artwork and the encoded URL can never drift apart.

const fs = require("fs");
const path = require("path");
const QRCode = require(path.join(__dirname, "..", "node_modules", "qrcode"));

const BROWN = "#4A2318";
const BROWN_MID = "#6B3A28";
const CARD = "#FCFBF9";

// Card geometry, in a coordinate space that maps 1:1 to tenths of a millimetre
// at the physical size set below — so a 900-unit width is 90 mm on paper.
const W = 900;
const H = 1680;

// Embedded once per card, so it is downscaled to what the layout actually
// needs at 300 DPI (32 mm ≈ 380 px). The full 917px original would inflate
// every one of 40 files by roughly a megabyte for no visible gain.
let _logo = null;
function logoDataUri() {
  if (_logo) return _logo;
  const p = path.join(__dirname, "logo-print.png");
  _logo = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  return _logo;
}

// ————————————————————————————— iconography
// Drawn as paths rather than a font, so nothing depends on an icon set being
// installed on whatever machine opens these.

function nfcMark(cx, cy, s) {
  const sw = s * 0.085;
  const st = `fill="none" stroke="${BROWN}" stroke-width="${sw}" stroke-linecap="round"`;
  // Broadcast arcs either side of the print.
  const wave = (r) =>
    `<path d="M ${cx - r} ${cy - r * 0.58} A ${r * 0.9} ${r * 0.9} 0 0 0 ${cx - r} ${cy + r * 0.58}" ${st}/>` +
    `<path d="M ${cx + r} ${cy - r * 0.58} A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx + r} ${cy + r * 0.58}" ${st}/>`;
  // Four nested ridges, open at the bottom — enough to read as a fingerprint
  // rather than a stack of arcs.
  const base = cy + s * 0.62;
  const ridge = (r) =>
    `<path d="M ${cx - r} ${base} A ${r} ${r * 1.2} 0 0 1 ${cx + r} ${base}" ${st}/>`;
  return `<g>${wave(s * 1.25)}${wave(s * 1.62)}
    ${ridge(s * 0.2)}${ridge(s * 0.38)}${ridge(s * 0.56)}${ridge(s * 0.74)}
    <circle cx="${cx + s * 0.62}" cy="${base - s * 0.02}" r="${s * 0.29}" fill="${BROWN}"/>
    <text x="${cx + s * 0.62}" y="${base - s * 0.02}" fill="#fff" font-family="Helvetica,Arial,sans-serif"
      font-size="${s * 0.24}" font-weight="700" text-anchor="middle" dominant-baseline="central">NFC</text></g>`;
}

function iconChat(cx, cy, s) {
  const w = s * 0.15;
  return `<g fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">
    <rect x="${cx - s * 0.62}" y="${cy - s * 0.42}" width="${s * 1.24}" height="${s * 0.95}" rx="${s * 0.26}"/>
    <line x1="${cx}" y1="${cy - s * 0.42}" x2="${cx}" y2="${cy - s * 0.72}"/>
    <circle cx="${cx}" cy="${cy - s * 0.82}" r="${s * 0.1}" fill="#fff"/>
    <circle cx="${cx - s * 0.24}" cy="${cy - s * 0.02}" r="${s * 0.1}" fill="#fff" stroke="none"/>
    <circle cx="${cx + s * 0.24}" cy="${cy - s * 0.02}" r="${s * 0.1}" fill="#fff" stroke="none"/>
    <line x1="${cx - s * 0.2}" y1="${cy + s * 0.28}" x2="${cx + s * 0.2}" y2="${cy + s * 0.28}"/>
  </g>`;
}

function iconReview(cx, cy, s) {
  const w = s * 0.14;
  const star = (x, y, r) => {
    let d = "";
    for (let i = 0; i < 5; i++) {
      const o = (Math.PI / 180) * (-90 + i * 72);
      const o2 = o + (Math.PI / 180) * 36;
      d += `${i ? "L" : "M"} ${x + Math.cos(o) * r} ${y + Math.sin(o) * r} L ${x + Math.cos(o2) * r * 0.45} ${y + Math.sin(o2) * r * 0.45} `;
    }
    return `<path d="${d}Z" fill="#fff"/>`;
  };
  return `<g>
    <rect x="${cx - s * 0.66}" y="${cy - s * 0.6}" width="${s * 1.32}" height="${s * 1.0}" rx="${s * 0.2}"
      fill="none" stroke="#fff" stroke-width="${w}"/>
    <path d="M ${cx - s * 0.24} ${cy + s * 0.4} L ${cx - s * 0.06} ${cy + s * 0.72} L ${cx + s * 0.12} ${cy + s * 0.4} Z" fill="#fff"/>
    ${star(cx - s * 0.34, cy - s * 0.22, s * 0.19)}
    ${star(cx, cy - s * 0.22, s * 0.19)}
    ${star(cx + s * 0.34, cy - s * 0.22, s * 0.19)}
    <path d="M ${cx - s * 0.3} ${cy + s * 0.12} L ${cx + s * 0.16} ${cy + s * 0.12}" stroke="#fff"
      stroke-width="${w}" stroke-linecap="round"/>
  </g>`;
}

function iconWifi(cx, cy, s) {
  const w = s * 0.17;
  const base = cy + s * 0.52;
  const arc = (r) =>
    `<path d="M ${cx - r} ${base - r * 0.42} A ${r} ${r} 0 0 1 ${cx + r} ${base - r * 0.42}"
      fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>`;
  return `<g>${arc(s * 0.85)}${arc(s * 0.52)}<circle cx="${cx}" cy="${base}" r="${s * 0.13}" fill="#fff"/></g>`;
}

function bottomIcon(cx, cy, r, draw, label) {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${BROWN}"/>
    ${draw(cx, cy, r * 0.62)}
    <text x="${cx}" y="${cy + r + 46}" fill="${BROWN}" font-family="Helvetica,Arial,sans-serif"
      font-size="30" text-anchor="middle">${label}</text>
  </g>`;
}

// ————————————————————————————— the card

async function tentSvg({ url, table, omitQr = false }) {
  const qr = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
    width: 1000,
    color: { dark: BROWN, light: "#ffffff" },
  });
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?)/.exec(qr);
  const mods = Number(vb[1]);
  const inner = qr.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

  // QR block placement on the card.
  const qs = 460;
  const qx = (W - qs) / 2;
  const qy = 720;

  // Centre disc carrying the table number. Kept to 18% of the code's width —
  // measured to fail only past ~38%, so this sits far inside the level-H budget.
  const c = mods / 2;
  const r = mods * 0.09;
  const fsz = r * (String(table).length > 2 ? 0.85 : 1.05);

  const qrBlock = omitQr
    ? ""
    : `<g transform="translate(${qx} ${qy}) scale(${qs / mods})">
    ${inner}
    <circle cx="${c}" cy="${c}" r="${r * 1.16}" fill="#ffffff"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="${BROWN_MID}"/>
    <text x="${c}" y="${c}" fill="#ffffff" font-family="Helvetica,Arial,sans-serif"
      font-size="${fsz}" font-weight="600" text-anchor="middle" dominant-baseline="central">${table}</text>
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${W / 10}mm" height="${H / 10}mm" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="70" fill="${CARD}"/>

  <image xlink:href="${logoDataUri()}" x="${(W - 320) / 2}" y="90" width="320" height="320"/>

  ${nfcMark(W / 2, 512, 80)}
  <text x="${W / 2}" y="672" fill="${BROWN}" font-family="Helvetica,Arial,sans-serif"
    font-size="46" font-weight="600" letter-spacing="3" text-anchor="middle">TAP HERE</text>

  ${qrBlock}

  <text x="${W / 2 - 40}" y="${qy + qs + 88}" fill="${BROWN}" font-family="Snell Roundhand,Brush Script MT,cursive"
    font-size="86" text-anchor="middle">scan me</text>
  <path d="M ${W / 2 + 118} ${qy + qs + 88} q 74 -16 84 -78" fill="none" stroke="${BROWN}"
    stroke-width="7" stroke-linecap="round"/>
  <path d="M ${W / 2 + 190} ${qy + qs + 10} l 12 -18 l 17 14" fill="none" stroke="${BROWN}"
    stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>

  <text x="${W / 2}" y="${H - 268}" fill="${BROWN}" font-family="Helvetica,Arial,sans-serif"
    font-size="48" font-weight="700" letter-spacing="2" text-anchor="middle">CONNECT WITH US</text>

  ${bottomIcon(W / 2 - 248, H - 150, 60, iconChat, "AI Chat")}
  ${bottomIcon(W / 2, H - 150, 60, iconReview, "Reviews")}
  ${bottomIcon(W / 2 + 248, H - 150, 60, iconWifi, "WiFi")}
</svg>`;
}

module.exports = { tentSvg, W, H, qrGeometry: { x: 220, y: 720, size: 460 } };

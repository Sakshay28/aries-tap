// The print master: a 40-page PDF, one table per page.
//
// The QR on every page is drawn as real vector geometry — one filled rectangle
// per module — rather than a picture of a QR. At any size the printer chooses,
// module edges land exactly on the mathematical boundary with no resampling,
// no anti-aliasing and no JPEG-style softening. That matters more here than
// anywhere else on the card: a scanner reads edges, and a soft edge at small
// print sizes is what makes a code fail in dim restaurant light.
//
// The rest of the card (logo, icons, lettering) rides underneath as a 600 DPI
// render, which is well past what any commercial press resolves.

const fs = require("fs");
const path = require("path");
const QRCode = require(path.join(__dirname, "..", "node_modules", "qrcode"));
const { tentSvg, W, H, qrGeometry } = require("./tent-template.js");

const M = "/private/tmp/claude-501/-Users-sakshay-Developer/0ac95434-a794-4348-bb11-e97d6cd6c6dc/scratchpad/node_modules/";
const sharp = require(M + "sharp");
const { PDFDocument, rgb } = require(M + "pdf-lib");

const BROWN = { r: 0x4a / 255, g: 0x23 / 255, b: 0x18 / 255 };
const BROWN_MID = { r: 0x6b / 255, g: 0x3a / 255, b: 0x28 / 255 };

// 90 x 168 mm expressed in PDF points.
const PW = (W / 10 / 25.4) * 72;
const PH = (H / 10 / 25.4) * 72;
const S = PW / W; // one SVG unit in points

async function build({ tables, out, baseUrl }) {
  const doc = await PDFDocument.create();
  doc.setTitle("Taffeta Coffee — Table Tents 1-40");
  doc.setSubject(
    "40 pages, each a DIFFERENT table. Print all 40 pages, 1 copy each. Do not duplicate any page. Trim size 90 x 168 mm.",
  );
  doc.setCreator("Aries Tap");
  const font = await doc.embedFont("Helvetica-Bold");

  for (const t of tables) {
    const url = `${baseUrl}/q/T${t}`;
    const label = String(t);

    // Background: the card with a deliberately empty QR window.
    const svg = await tentSvg({ url, table: label, omitQr: true });
    // The card is authored in millimetres, and sharp multiplies that by the
    // density — so 300 already rasterizes far above 600 DPI. Render once at
    // that native size and resample down to an exact 600 DPI target with a
    // high-quality kernel, rather than asking for a density that overflows.
    const bg = await sharp(Buffer.from(svg), { density: 300 })
      .resize(Math.round((W / 10 / 25.4) * 600), Math.round((H / 10 / 25.4) * 600), {
        kernel: "lanczos3",
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const page = doc.addPage([PW, PH]);
    page.drawImage(await doc.embedPng(bg), { x: 0, y: 0, width: PW, height: PH });

    // The QR itself, as vector.
    const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
    const n = qr.modules.size;
    const data = qr.modules.data;
    const cell = (qrGeometry.size * S) / n;
    const left = qrGeometry.x * S;
    // PDF's origin is bottom-left; the layout is authored top-down.
    const top = PH - qrGeometry.y * S;

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (!data[row * n + col]) continue;
        page.drawRectangle({
          x: left + col * cell,
          // A hairline overdraw closes the seams that otherwise appear between
          // adjacent modules when a RIP rounds coordinates independently.
          y: top - (row + 1) * cell - cell * 0.02,
          width: cell * 1.04,
          height: cell * 1.04,
          color: rgb(BROWN.r, BROWN.g, BROWN.b),
        });
      }
    }

    // Centre disc carrying the table number: quiet ring, disc, numeral.
    const cx = left + (qrGeometry.size * S) / 2;
    const cy = top - (qrGeometry.size * S) / 2;
    const r = qrGeometry.size * S * 0.09;
    page.drawCircle({ x: cx, y: cy, size: r * 1.16, color: rgb(1, 1, 1) });
    page.drawCircle({ x: cx, y: cy, size: r, color: rgb(BROWN_MID.r, BROWN_MID.g, BROWN_MID.b) });

    const fsz = r * (label.length > 2 ? 1.0 : 1.25);
    const tw = font.widthOfTextAtSize(label, fsz);
    page.drawText(label, {
      x: cx - tw / 2,
      y: cy - font.heightAtSize(fsz) * 0.36,
      size: fsz,
      font,
      color: rgb(1, 1, 1),
    });
  }

  fs.writeFileSync(out, await doc.save());
  return out;
}

module.exports = { build, PW, PH };

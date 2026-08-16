// Client-side image compression. Photos are shrunk in the browser before they
// ever leave the device — smaller uploads, faster submits, and the 10 MB phone
// snapshot never hits the wire. Uses a canvas so there's no dependency, respects
// EXIF orientation, and steps the quality down until the result clears our
// stored-size ceiling.

const MAX_DIMENSION = 1600; // longest edge, px
const TARGET_BYTES = 850 * 1024; // aim under the server's MAX_STORED_BYTES
const MIN_QUALITY = 0.45;

export type Compressed = { dataUrl: string; bytes: number; type: string };

export async function compressImage(file: File): Promise<Compressed> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  // Prefer WEBP where the browser can encode it (smaller at equal quality),
  // else JPEG. PNG is intentionally avoided for photos.
  const type = canEncodeWebp(canvas) ? "image/webp" : "image/jpeg";

  let quality = 0.82;
  let blob = await toBlob(canvas, type, quality);
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12);
    blob = await toBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("Compression failed");

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, bytes: blob.size, type };
}

// —————————————————————————————— internals

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function canEncodeWebp(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not encode image"));
    reader.readAsDataURL(blob);
  });
}

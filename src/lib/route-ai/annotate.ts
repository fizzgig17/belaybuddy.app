import jpeg from 'jpeg-js';

import type { Pixels } from './detect';
import type { NumberedHold } from './tips';

// 3x5 digits, one string per row.
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

function encodeJpeg(image: { data: Uint8Array; width: number; height: number }, quality: number): Uint8Array {
  // jpeg-js's encoder reaches for Node's Buffer when it runs under a bundler; the phone has none.
  const g = globalThis as unknown as { Buffer?: { from(a: ArrayLike<number>): Uint8Array } };
  const had = g.Buffer;
  if (!had) g.Buffer = { from: (a) => Uint8Array.from(a) };
  try {
    return jpeg.encode(image, quality).data as unknown as Uint8Array;
  } finally {
    if (!had) delete g.Buffer;
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}

/**
 * A copy of the photo with a magenta box and a number around every hold, as a base64 JPEG, so the AI can say which
 * boxes are wrong by number. The picture on screen is never touched.
 */
export function annotatedPhoto(pixels: Pixels, holds: NumberedHold[]): string {
  const { width: w, height: h } = pixels;
  const data = new Uint8Array(pixels.data);
  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  const S = 3;
  for (const hold of holds) {
    const pad = 4;
    const x0 = Math.round((hold.x - hold.w / 2) * w) - pad;
    const x1 = Math.round((hold.x + hold.w / 2) * w) + pad;
    const y0 = Math.round((hold.y - hold.h / 2) * h) - pad;
    const y1 = Math.round((hold.y + hold.h / 2) * h) + pad;
    for (let t = 0; t < 2; t++) {
      for (let x = x0; x <= x1; x++) {
        put(x, y0 + t, 255, 0, 200);
        put(x, y1 - t, 255, 0, 200);
      }
      for (let y = y0; y <= y1; y++) {
        put(x0 + t, y, 255, 0, 200);
        put(x1 - t, y, 255, 0, 200);
      }
    }
    // Number tag above the box (below it at the top edge of the picture).
    const text = String(hold.n);
    const tw = text.length * 4 * S + S;
    const th = 7 * S;
    const tx = Math.min(Math.max(0, x0), w - tw);
    const ty = y0 - th >= 0 ? y0 - th : y1 + 1;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) put(tx + x, ty + y, 255, 0, 200);
    [...text].forEach((ch, ci) => {
      const rows = DIGITS[ch];
      if (!rows) return;
      rows.forEach((row, ry) =>
        [...row].forEach((bit, rx) => {
          if (bit !== '1') return;
          for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(tx + S + ci * 4 * S + rx * S + dx, ty + S + ry * S + dy, 255, 255, 255);
        }),
      );
    });
  }
  return toBase64(encodeJpeg({ data, width: w, height: h }, 78));
}

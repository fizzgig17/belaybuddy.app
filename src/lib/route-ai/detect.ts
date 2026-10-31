/**
 * Hold detection for Route AI, in plain code (no AI call, no native modules): given the pixels
 * of a wall photo and one tapped hold, find every hold of that color. Runs the same on iOS and web.
 *
 * Colors are compared in CIELAB, with lightness down-weighted so the same hold in shadow still
 * matches. Positions are normalized (0..1) so they don't depend on the working image size.
 */

export type Pixels = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export type Hold = {
  id: number;
  /** Center and size, normalized to the image (0..1). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** True for holds the user added by tapping. */
  manual?: boolean;
  /** A manual hold where no coherent region grew (drawn as a small circle). */
  guessed?: boolean;
};

export type Sensitivity = 'low' | 'normal' | 'high';

/** Seed color, in Lab. */
export type Seed = { L: number; a: number; b: number };

const THRESHOLD: Record<Sensitivity, number> = { low: 12, normal: 17, high: 20 };
/** How much lightness differences count compared to hue/chroma differences. */
const L_WEIGHT = 0.25;
/** Max hue difference (degrees) for colored seeds, so a pale blue hold can't match a tan wall. */
const HUE_TOLERANCE: Record<Sensitivity, number> = { low: 20, normal: 28, high: 34 };

const LINEAR = new Float32Array(256).map((_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});

function srgbToLinear(v: number) {
  return LINEAR[Math.max(0, Math.min(255, Math.round(v)))];
}

function labF(t: number) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab(r: number, g: number, b: number): Seed {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = labF(X);
  const fy = labF(Y);
  const fz = labF(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Unsharp mask: adds back the difference between the picture and a blurred copy of it, so a soft, out-of-focus
 * hold gets crisper edges and its true color pulls away from the wall. Cached per picture.
 */
const sharpCache = new WeakMap<object, Pixels>();
export function sharpened(img: Pixels, radius = 3, amount = 1.4): Pixels {
  const cached = sharpCache.get(img);
  if (cached) return cached;
  const { width: w, height: h } = img;
  const out = new Uint8ClampedArray(img.data.length);
  const blurred = new Float32Array(w * h);
  const tmp = new Float32Array(w * h);
  for (let c = 0; c < 3; c++) {
    // Box blur, horizontal then vertical, with running sums.
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += img.data[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / (2 * radius + 1);
        sum += img.data[(y * w + Math.min(w - 1, x + radius + 1)) * 4 + c];
        sum -= img.data[(y * w + Math.max(0, x - radius)) * 4 + c];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        blurred[y * w + x] = sum / (2 * radius + 1);
        sum += tmp[Math.min(h - 1, y + radius + 1) * w + x];
        sum -= tmp[Math.max(0, y - radius) * w + x];
      }
    }
    for (let i = 0; i < w * h; i++) {
      const v = img.data[i * 4 + c];
      out[i * 4 + c] = v + (v - blurred[i]) * amount;
    }
  }
  for (let i = 0; i < w * h; i++) out[i * 4 + 3] = 255;
  const result = { width: w, height: h, data: out };
  sharpCache.set(img, result);
  return result;
}

/** Lab for every pixel, as three flat arrays. */
function toLab(img: Pixels) {
  const n = img.width * img.height;
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lab = rgbToLab(img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]);
    L[i] = lab.L;
    A[i] = lab.a;
    B[i] = lab.b;
  }
  return { L, A, B };
}

type LabImage = ReturnType<typeof toLab> & { width: number; height: number };

const labCache = new WeakMap<object, LabImage>();
function labOf(img: Pixels): LabImage {
  let cached = labCache.get(img);
  if (!cached) {
    cached = { ...toLab(sharpened(img)), width: img.width, height: img.height };
    labCache.set(img, cached);
  }
  return cached;
}

function median(values: number[]) {
  const s = [...values].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

/** Median color of a small patch around a tapped point (nx, ny in 0..1). */
export function sampleSeed(source: Pixels, nx: number, ny: number, radius = 3): Seed {
  const img = sharpened(source);
  const cx = Math.round(nx * (img.width - 1));
  const cy = Math.round(ny * (img.height - 1));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = Math.max(0, cy - radius); y <= Math.min(img.height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(img.width - 1, cx + radius); x++) {
      const i = (y * img.width + x) * 4;
      rs.push(img.data[i]);
      gs.push(img.data[i + 1]);
      bs.push(img.data[i + 2]);
    }
  }
  return rgbToLab(median(rs), median(gs), median(bs));
}

function colorMask(lab: LabImage, seed: Seed, threshold: number, hueTol: number, chromaFloor = 0.55) {
  const n = lab.width * lab.height;
  const mask = new Uint8Array(n);
  const seedChroma = Math.hypot(seed.a, seed.b);
  const seedHue = Math.atan2(seed.b, seed.a);
  // Black, white and grey holds: lightness is the whole story, so it counts in full and color must stay low.
  const neutral = seedChroma <= 5;
  const lWeight = neutral ? 1 : L_WEIGHT;
  for (let i = 0; i < n; i++) {
    const dL = (lab.L[i] - seed.L) * lWeight;
    const dA = lab.A[i] - seed.a;
    const dB = lab.B[i] - seed.b;
    if (Math.sqrt(dL * dL + dA * dA + dB * dB) > threshold) continue;
    // A colorful seed must not match washed-out grey pixels, and a grey seed must not match color.
    const chroma = Math.hypot(lab.A[i], lab.B[i]);
    if (neutral && Math.hypot(lab.A[i], lab.B[i]) > 12) continue;
    if (seedChroma > 5) {
      if (chroma < seedChroma * chromaFloor) continue;
      let dh = Math.abs(Math.atan2(lab.B[i], lab.A[i]) - seedHue);
      if (dh > Math.PI) dh = 2 * Math.PI - dh;
      if ((dh * 180) / Math.PI > hueTol) continue;
    }
    mask[i] = 1;
  }
  return mask;
}

/** 3x3 majority filter: drops isolated specks and fills pinholes without erasing small holds. */
function clean(mask: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const n =
        mask[i - w - 1] + mask[i - w] + mask[i - w + 1] +
        mask[i - 1] + mask[i] + mask[i + 1] +
        mask[i + w - 1] + mask[i + w] + mask[i + w + 1];
      if (n >= 5) out[i] = 1;
    }
  }
  return out;
}

type Blob = { area: number; minX: number; maxX: number; minY: number; maxY: number; sx: number; sy: number };

function components(mask: Uint8Array, w: number, h: number): Blob[] {
  const seen = new Uint8Array(mask.length);
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const blob: Blob = { area: 0, minX: w, maxX: 0, minY: h, maxY: 0, sx: 0, sy: 0 };
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      blob.area++;
      blob.sx += x;
      blob.sy += y;
      if (x < blob.minX) blob.minX = x;
      if (x > blob.maxX) blob.maxX = x;
      if (y < blob.minY) blob.minY = y;
      if (y > blob.maxY) blob.maxY = y;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) (seen[i - 1] = 1), stack.push(i - 1);
      if (x < w - 1 && mask[i + 1] && !seen[i + 1]) (seen[i + 1] = 1), stack.push(i + 1);
      if (y > 0 && mask[i - w] && !seen[i - w]) (seen[i - w] = 1), stack.push(i - w);
      if (y < h - 1 && mask[i + w] && !seen[i + w]) (seen[i + w] = 1), stack.push(i + w);
    }
    blobs.push(blob);
  }
  return blobs;
}

function blobToHold(blob: Blob, w: number, h: number, id: number, manual?: boolean): Hold {
  return {
    id,
    x: blob.sx / blob.area / w,
    y: blob.sy / blob.area / h,
    w: (blob.maxX - blob.minX + 1) / w,
    h: (blob.maxY - blob.minY + 1) / h,
    manual,
  };
}

/** Finds every hold matching the seed color. */
export function detectHolds(img: Pixels, seedOrSeeds: Seed | Seed[], sensitivity: Sensitivity = 'normal'): Hold[] {
  const { width: w, height: h } = img;
  const lab = labOf(img);
  // Several seeds (a lit hold, a shaded one) match the union of their colors.
  const seeds = Array.isArray(seedOrSeeds) ? seedOrSeeds : [seedOrSeeds];
  const joined = new Uint8Array(w * h);
  for (const seed of seeds) {
    const m = colorMask(lab, seed, THRESHOLD[sensitivity], HUE_TOLERANCE[sensitivity]);
    for (let i = 0; i < m.length; i++) if (m[i]) joined[i] = 1;
  }
  const mask = clean(joined, w, h);
  const minArea = Math.max(24, w * h * 0.00005);
  const maxArea = w * h * 0.03;
  const holds: Hold[] = [];
  for (const blob of components(mask, w, h)) {
    if (blob.area < minArea || blob.area > maxArea) continue;
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    // Streaks (tape lines, wall seams) are long and thin or mostly empty inside their box.
    if (Math.max(bw, bh) / Math.min(bw, bh) > 4.5) continue;
    if (blob.area / (bw * bh) < 0.35) continue;
    // Real holds are small next to the wall; a huge box is a shadow or a wall panel.
    if (Math.max(bw, bh) > w * 0.2) continue;
    holds.push(blobToHold(blob, w, h, holds.length + 1));
  }

  // Second, more forgiving pass for blurry holds: out of focus, a hold's color washes toward the wall, so the strict
  // match misses it. Accept a washed-out blob only when it is round and solid, big enough not to be noise, and sits
  // in the trail of holds already found (so a stray yellow shirt still doesn't count).
  if (holds.length >= 3) {
    const loose = new Uint8Array(w * h);
    for (const seed of seeds) {
      const m = colorMask(lab, seed, THRESHOLD[sensitivity] * 1.4, HUE_TOLERANCE[sensitivity] + 12, 0.3);
      for (let i = 0; i < m.length; i++) if (m[i]) loose[i] = 1;
    }
    const reach = 0.2 * Math.max(w, h);
    for (const blob of components(clean(loose, w, h), w, h)) {
      if (blob.area < minArea * 3 || blob.area > maxArea) continue;
      const bw = blob.maxX - blob.minX + 1;
      const bh = blob.maxY - blob.minY + 1;
      if (Math.max(bw, bh) / Math.min(bw, bh) > 2.5) continue;
      if (blob.area / (bw * bh) < 0.5) continue;
      if (Math.max(bw, bh) > w * 0.12) continue;
      const hold = blobToHold(blob, w, h, 0);
      const overlaps = holds.some(
        (o) => Math.abs(o.x - hold.x) < (o.w + hold.w) / 2 && Math.abs(o.y - hold.y) < (o.h + hold.h) / 2,
      );
      if (overlaps) continue;
      const near = holds.some((o) => Math.hypot((o.x - hold.x) * w, (o.y - hold.y) * h) <= reach);
      if (!near) continue;
      holds.push({ ...hold, id: holds.length + 1 });
    }
  }
  return dropStrays(holds, w, h);
}

/**
 * A route is a trail of holds; a same-colored thing far from all the others (a shirt, a bag, a sign across the
 * gym) is not part of it. Drops holds with no other hold within about a fifth of the picture. Needs a few holds
 * to judge by, so a handful found is left alone.
 */
export function dropStrays(holds: Hold[], w: number, h: number): Hold[] {
  if (holds.length < 5) return holds;
  const reach = 0.2 * Math.max(w, h);
  const kept = holds.filter((a) =>
    holds.some((b) => b !== a && Math.hypot((a.x - b.x) * w, (a.y - b.y) * h) <= reach),
  );
  // If that would throw most of them away the holds are just spread out: keep what was found.
  return kept.length >= holds.length * 0.5 ? kept.map((k, i) => ({ ...k, id: i + 1 })) : holds;
}

/**
 * Adds a hold the detector missed: grows a region from the tapped pixel using that pixel's own
 * color. Falls back to a small circle if nothing coherent grows.
 */
export function growHoldAt(img: Pixels, nx: number, ny: number, id: number): Hold {
  const { width: w, height: h } = img;
  const lab = labOf(img);
  const local = sampleSeed(img, nx, ny, 2);
  const mask = colorMask(lab, local, THRESHOLD.normal, HUE_TOLERANCE.normal);
  const cx = Math.round(nx * (w - 1));
  const cy = Math.round(ny * (h - 1));
  const maxR = Math.round(Math.min(w, h) * 0.1);

  const seen = new Set<number>();
  const stack = [cy * w + cx];
  seen.add(stack[0]);
  const blob: Blob = { area: 0, minX: w, maxX: 0, minY: h, maxY: 0, sx: 0, sy: 0 };
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    blob.area++;
    blob.sx += x;
    blob.sy += y;
    blob.minX = Math.min(blob.minX, x);
    blob.maxX = Math.max(blob.maxX, x);
    blob.minY = Math.min(blob.minY, y);
    blob.maxY = Math.max(blob.maxY, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nxp = x + dx;
      const nyp = y + dy;
      if (nxp < 0 || nyp < 0 || nxp >= w || nyp >= h) continue;
      if (Math.abs(nxp - cx) > maxR || Math.abs(nyp - cy) > maxR) continue;
      const j = nyp * w + nxp;
      if (mask[j] && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  const minArea = Math.max(24, w * h * 0.00005);
  if (blob.area >= minArea) return blobToHold(blob, w, h, id, true);
  const r = Math.max(6, Math.min(w, h) * 0.03);
  return { id, x: nx, y: ny, w: (2 * r) / w, h: (2 * r) / h, manual: true, guessed: true };
}

/** The hold under a tap, if any (nearest center within its box, a bit generous for fingers). */
export function holdAt(holds: Hold[], nx: number, ny: number, slack = 0.015): Hold | undefined {
  let best: Hold | undefined;
  let bestDist = Infinity;
  for (const hold of holds) {
    const dx = Math.abs(nx - hold.x);
    const dy = Math.abs(ny - hold.y);
    if (dx <= hold.w / 2 + slack && dy <= hold.h / 2 + slack) {
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        best = hold;
        bestDist = d;
      }
    }
  }
  return best;
}

/**
 * Whether a tapped pixel's color is close enough to the first seed to be the same kind of hold.
 * A tap on a shadow or the bare wall would otherwise teach the match a color that fills the photo
 * with false holds.
 */
export function isSimilarSeed(base: Seed, candidate: Seed): boolean {
  const baseChroma = Math.hypot(base.a, base.b);
  const candChroma = Math.hypot(candidate.a, candidate.b);
  if (baseChroma <= 5) return candChroma <= 8 && Math.abs(base.L - candidate.L) <= 35;
  if (candChroma < Math.max(8, baseChroma * 0.5)) return false;
  let dh = Math.abs(Math.atan2(candidate.b, candidate.a) - Math.atan2(base.b, base.a));
  if (dh > Math.PI) dh = 2 * Math.PI - dh;
  return (dh * 180) / Math.PI <= 45;
}

/**
 * Tightens each hold's box using Apple Vision's separate objects. When the object under a hold is hold-sized and
 * about the size of the color box, the object's own box replaces it (it follows the hold's real edge, blurry or not).
 * Anything that looks off (wall-sized object, a cluster, no object there) keeps the color box.
 */
export function refineWithObjects(holds: Hold[], mask: { width: number; height: number; labels: Uint8Array }): Hold[] {
  const { width: mw, height: mh, labels } = mask;
  const boxes = new Map<number, { minX: number; maxX: number; minY: number; maxY: number; area: number }>();
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const l = labels[y * mw + x];
      if (!l) continue;
      const b = boxes.get(l);
      if (!b) boxes.set(l, { minX: x, maxX: x, minY: y, maxY: y, area: 1 });
      else {
        if (x < b.minX) b.minX = x;
        if (x > b.maxX) b.maxX = x;
        if (y < b.minY) b.minY = y;
        if (y > b.maxY) b.maxY = y;
        b.area++;
      }
    }
  }
  return holds.map((hold) => {
    // The object most common under the hold's middle.
    const counts = new Map<number, number>();
    const cx = Math.round(hold.x * (mw - 1));
    const cy = Math.round(hold.y * (mh - 1));
    const rx = Math.max(1, Math.round((hold.w * mw) / 6));
    const ry = Math.max(1, Math.round((hold.h * mh) / 6));
    for (let y = Math.max(0, cy - ry); y <= Math.min(mh - 1, cy + ry); y++) {
      for (let x = Math.max(0, cx - rx); x <= Math.min(mw - 1, cx + rx); x++) {
        const l = labels[y * mw + x];
        if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
      }
    }
    let label = 0;
    let best = 0;
    counts.forEach((n, l) => {
      if (n > best) { best = n; label = l; }
    });
    const b = label ? boxes.get(label) : undefined;
    if (!b) return hold;
    const w = (b.maxX - b.minX + 1) / mw;
    const h = (b.maxY - b.minY + 1) / mh;
    if (w > 0.2 || h > 0.2) return hold;
    const ratio = (w * h) / (hold.w * hold.h);
    if (ratio < 0.5 || ratio > 2.5) return hold;
    return { ...hold, x: (b.minX + b.maxX + 1) / 2 / mw, y: (b.minY + b.maxY + 1) / 2 / mh, w, h };
  });
}

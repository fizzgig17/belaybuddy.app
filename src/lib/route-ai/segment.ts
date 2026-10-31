import { matchesSeed, rgbToLab, type Hold, type Pixels, type Seed, type Sensitivity } from './detect';

/** One cut-out from the phone's segmentation model: the object's box (0..1) and a small mask grid inside the box. */
export type Segment = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Share of the whole picture the object covers. */
  area: number;
  /** The model's own confidence in the cut-out, 0..1. */
  iou: number;
  gw: number;
  gh: number;
  /** Base64, one byte per cell, 1 where the object is. */
  grid: string;
};

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Turns cut-outs into holds. Each cut-out was made at a spot the color match suggested; it is kept only if the object
 * itself (not its surroundings) is the route's color, and it is hold-sized and compact. The hold's box is then the
 * object's real outline box, which is what lets this tell a hold from a patch of similarly tinted wall.
 */
export function holdsFromSegments(
  segments: (Segment | null)[],
  pixels: Pixels,
  seeds: Seed[],
  sensitivity: Sensitivity = 'normal',
): Hold[] {
  const { width: w, height: h, data } = pixels;
  const found: Hold[] = [];
  for (const seg of segments) {
    if (!seg || seg.iou < 0.6) continue;
    const bw = seg.x1 - seg.x0;
    const bh = seg.y1 - seg.y0;
    if (bw <= 0 || bh <= 0 || seg.area > 0.06 || seg.area < 0.00008) continue;
    if (bw > 0.3 || bh > 0.3) continue;
    const pxW = bw * w;
    const pxH = bh * h;
    if (Math.max(pxW, pxH) / Math.max(1, Math.min(pxW, pxH)) > 4) continue;
    const bin = atob(seg.grid);
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    let on = 0;
    for (let j = 0; j < seg.gh; j++) {
      for (let i = 0; i < seg.gw; i++) {
        if (bin.charCodeAt(j * seg.gw + i) !== 1) continue;
        on++;
        const x = Math.min(w - 1, Math.max(0, Math.floor((seg.x0 + ((i + 0.5) / seg.gw) * bw) * w)));
        const y = Math.min(h - 1, Math.max(0, Math.floor((seg.y0 + ((j + 0.5) / seg.gh) * bh) * h)));
        const k = (y * w + x) * 4;
        rs.push(data[k]);
        gs.push(data[k + 1]);
        bs.push(data[k + 2]);
      }
    }
    // A mask that fills little of its own box is a ragged shape, not a hold.
    if (on < 12 || on / (seg.gw * seg.gh) < 0.3) continue;
    const color = rgbToLab(median(rs), median(gs), median(bs));
    if (!seeds.some((s) => matchesSeed(color, s, sensitivity, 1.5))) continue;
    found.push({ id: 0, x: (seg.x0 + seg.x1) / 2, y: (seg.y0 + seg.y1) / 2, w: bw, h: bh, outline: outlineOf(seg) });
  }
  // Two spots can land on the same hold: keep one.
  const kept: Hold[] = [];
  for (const hold of found) {
    const twin = kept.some((o) => {
      const ix = Math.min(o.x + o.w / 2, hold.x + hold.w / 2) - Math.max(o.x - o.w / 2, hold.x - hold.w / 2);
      const iy = Math.min(o.y + o.h / 2, hold.y + hold.h / 2) - Math.max(o.y - o.h / 2, hold.y - hold.h / 2);
      if (ix <= 0 || iy <= 0) return false;
      return (ix * iy) / Math.min(o.w * o.h, hold.w * hold.h) > 0.5;
    });
    if (!twin) kept.push(hold);
  }
  return kept.map((k, i) => ({ ...k, id: i + 1 }));
}

/**
 * The outline of a cut-out as line pieces in photo coordinates (0..1). Holes inside the object (a bolt hole) are
 * filled first so only the outer edge is drawn.
 */
export function outlineOf(seg: Segment): [number, number, number, number][] {
  const { gw, gh } = seg;
  const bin = atob(seg.grid);
  const cells = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) cells[i] = bin.charCodeAt(i) === 1 ? 1 : 0;
  // Anything not reachable from the border without crossing the object is a hole: fill it.
  const outside = new Uint8Array(gw * gh);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!cells[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let i = 0; i < gw; i++) {
    seed(i);
    seed((gh - 1) * gw + i);
  }
  for (let j = 0; j < gh; j++) {
    seed(j * gw);
    seed(j * gw + gw - 1);
  }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % gw;
    const y = (k - x) / gw;
    if (x > 0) seed(k - 1);
    if (x < gw - 1) seed(k + 1);
    if (y > 0) seed(k - gw);
    if (y < gh - 1) seed(k + gw);
  }
  for (let i = 0; i < gw * gh; i++) if (!cells[i] && !outside[i]) cells[i] = 1;

  const on = (i: number, j: number) => i >= 0 && j >= 0 && i < gw && j < gh && cells[j * gw + i] === 1;
  const bw = seg.x1 - seg.x0;
  const bh = seg.y1 - seg.y0;
  const px = (i: number) => seg.x0 + (i / gw) * bw;
  const py = (j: number) => seg.y0 + (j / gh) * bh;
  const out: [number, number, number, number][] = [];
  for (let j = 0; j <= gh; j++) {
    let start = -1;
    for (let i = 0; i <= gw; i++) {
      const edge = i < gw && on(i, j - 1) !== on(i, j);
      if (edge && start < 0) start = i;
      if (!edge && start >= 0) {
        out.push([px(start), py(j), px(i), py(j)]);
        start = -1;
      }
    }
  }
  for (let i = 0; i <= gw; i++) {
    let start = -1;
    for (let j = 0; j <= gh; j++) {
      const edge = j < gh && on(i - 1, j) !== on(i, j);
      if (edge && start < 0) start = j;
      if (!edge && start >= 0) {
        out.push([px(i), py(start), px(i), py(j)]);
        start = -1;
      }
    }
  }
  return out;
}

/** An SVG path for an outline, scaled to a drawing of the given size. */
export function outlinePath(outline: [number, number, number, number][], w: number, h: number): string {
  let d = '';
  for (const [x1, y1, x2, y2] of outline) d += `M${(x1 * w).toFixed(1)} ${(y1 * h).toFixed(1)}L${(x2 * w).toFixed(1)} ${(y2 * h).toFixed(1)}`;
  return d;
}

/**
 * Spots to hand the segmentation model: the color blobs' centers first, then a grid over the photo, keeping grid spots
 * whose color is even loosely like the route's. The model skips spots inside something it already cut out, so a dense
 * grid costs little, and holds the color blob step missed (small, shaded, split by a rope) still get a look.
 */
export function proposePoints(
  pixels: Pixels,
  seeds: Seed[],
  sensitivity: Sensitivity,
  first: [number, number][],
  limit = 500,
): [number, number][] {
  const { width: w, height: h, data } = pixels;
  const points: [number, number][] = [...first];
  const step = Math.max(8, Math.round(w / 100));
  for (let y = Math.floor(step / 2); y < h - 1; y += step) {
    for (let x = Math.floor(step / 2); x < w - 1; x += step) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = ((y + dy) * w + (x + dx)) * 4;
          r += data[k];
          g += data[k + 1];
          b += data[k + 2];
        }
      }
      const lab = rgbToLab(r / 9, g / 9, b / 9);
      if (seeds.some((s) => matchesSeed(lab, s, sensitivity, 1.8))) points.push([(x + 0.5) / w, (y + 0.5) / h]);
    }
  }
  return points.slice(0, limit);
}

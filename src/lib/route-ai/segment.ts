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
    found.push({ id: 0, x: (seg.x0 + seg.x1) / 2, y: (seg.y0 + seg.y1) / 2, w: bw, h: bh });
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

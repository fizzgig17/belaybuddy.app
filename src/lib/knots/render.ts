import { pathBetween, type Rope } from '@/lib/knots/geometry';

export type Layer = {
  key: string;
  d: string;
  stroke: string;
  width: number;
  opacity?: number;
  dash?: string;
  cap?: 'round' | 'butt';
  /** Small shift, used for the highlight and shadow. */
  dx?: number;
  dy?: number;
};
export type Strand = { rope: Rope; /** Arc length drawn so far. */ drawn: number; fill: string; outline: string };

export const ROPE_WIDTH = 14;
const EDGE = 2; // dark edge on each side of the rope
const WINDOW = 26; // how far each side of a crossing the "on top" strand is redrawn
const RIB = 6; // spacing of the sheath's weave marks, in px along the rope

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb color. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * One piece of rope drawn as a rounded cylinder: a dark edge, a body that is darker toward
 * the sides and lighter in the middle, weave marks, and a soft highlight.
 */
function ropePiece(key: string, d: string, s: Strand, cap: 'round' | 'butt'): Layer[] {
  const W = ROPE_WIDTH;
  return [
    { key: `${key}o`, d, stroke: s.outline, width: W + EDGE * 2, cap },
    { key: `${key}f`, d, stroke: shade(s.fill, -0.18), width: W, cap },
    { key: `${key}m`, d, stroke: s.fill, width: W * 0.72, cap },
    { key: `${key}l`, d, stroke: shade(s.fill, 0.3), width: W * 0.36, cap },
    // Weave marks: short dashes across the rope, like the braided sheath.
    { key: `${key}w`, d, stroke: s.outline, width: W, opacity: 0.22, dash: `1.4 ${RIB - 1.4}`, cap: 'butt' },
    { key: `${key}h`, d, stroke: '#FFFFFF', width: 2, opacity: 0.45, dx: -1.5, dy: -1.5, cap },
  ];
}

/**
 * Layers to paint, bottom to top. First every strand so far; then, wherever a strand passes
 * over another, a short piece redrawn on top (with a soft shadow beneath it falling on the
 * strand it crosses). The top pieces have flat ends so they join the rope seamlessly.
 */
export function strandLayers(strands: Strand[]): Layer[] {
  const layers: Layer[] = [];
  strands.forEach((s, i) => {
    if (s.drawn < 2) return; // nothing drawn yet (avoids a stray dot)
    const base = pathBetween(s.rope, 0, s.drawn);
    if (base) layers.push(...ropePiece(`b${i}`, base, s, 'round'));
  });
  const tops: { s: Strand; i: number; k: number; d: string }[] = [];
  strands.forEach((s, i) =>
    s.rope.overs.forEach((c, k) => {
      if (c.s + WINDOW > s.drawn) return;
      // Start on a weave-mark boundary so the marks line up with the rope underneath.
      const from = Math.max(0, Math.floor((c.s - WINDOW) / RIB) * RIB);
      const d = pathBetween(s.rope, from, c.s + WINDOW);
      if (d) tops.push({ s, i, k, d });
    }),
  );
  tops.forEach((t) => {
    layers.push({ key: `sa${t.i}-${t.k}`, d: t.d, stroke: '#000000', width: ROPE_WIDTH + EDGE * 2 + 8, opacity: 0.1, cap: 'butt' });
    layers.push({ key: `sb${t.i}-${t.k}`, d: t.d, stroke: '#000000', width: ROPE_WIDTH + EDGE * 2 + 4, opacity: 0.16, cap: 'butt' });
  });
  tops.forEach((t) => layers.push(...ropePiece(`t${t.i}-${t.k}`, t.d, t.s, 'butt')));
  return layers;
}

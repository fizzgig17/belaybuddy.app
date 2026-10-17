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
const RIB = 6; // spacing of the sheath's weave marks, in px along the rope

/** One piece of rope drawn like a real one: outline, body, weave marks and a soft highlight. */
function ropePiece(key: string, d: string, s: Strand): Layer[] {
  return [
    { key: `${key}o`, d, stroke: s.outline, width: ROPE_WIDTH + 3 },
    { key: `${key}f`, d, stroke: s.fill, width: ROPE_WIDTH },
    // Weave marks: short dashes across the rope, like the braided sheath.
    { key: `${key}w`, d, stroke: s.outline, width: ROPE_WIDTH - 1, opacity: 0.28, dash: `1.6 ${RIB - 1.6}`, cap: 'butt' },
    // Light from the upper left.
    { key: `${key}h`, d, stroke: '#FFFFFF', width: 3, opacity: 0.35, dx: -2, dy: -2 },
  ];
}

/** Layers to paint, bottom to top: each strand as drawn so far, later strands over earlier ones. */
export function strandLayers(strands: Strand[]): Layer[] {
  const layers: Layer[] = [];
  strands.forEach((s, i) => {
    if (s.drawn < 2) return; // nothing drawn yet (avoids a stray dot)
    const base = pathBetween(s.rope, 0, s.drawn);
    if (base) layers.push(...ropePiece(`b${i}`, base, s));
  });
  return layers;
}

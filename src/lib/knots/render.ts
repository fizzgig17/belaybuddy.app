import { pathBetween, type Rope } from '@/lib/knots/geometry';

export type Layer = { key: string; d: string; stroke: string; width: number };
export type Strand = { rope: Rope; /** Arc length drawn so far. */ drawn: number; fill: string; outline: string };

export const ROPE_WIDTH = 11;
const WINDOW = 15; // how far each side of a crossing the "on top" strand is redrawn

/**
 * Layers to paint, bottom to top, for one or more strands: first every strand so far, then
 * (for each place a strand passes over another) a short piece redrawn on top, with a
 * background-colored gap cut around it so the strand underneath looks interrupted.
 * All the gaps are cut before any top pieces are drawn, so strands that run side by side
 * stay intact.
 */
export function strandLayers(strands: Strand[], background: string): Layer[] {
  const layers: Layer[] = [];
  strands.forEach((s, i) => {
    const base = pathBetween(s.rope, 0, s.drawn);
    if (!base) return;
    layers.push({ key: `o${i}`, d: base, stroke: s.outline, width: ROPE_WIDTH + 3 });
    layers.push({ key: `r${i}`, d: base, stroke: s.fill, width: ROPE_WIDTH });
  });
  const tops: { s: Strand; i: number; k: number; d: string }[] = [];
  strands.forEach((s, i) =>
    s.rope.overs.forEach((c, k) => {
      if (c.s + WINDOW > s.drawn) return;
      const d = pathBetween(s.rope, c.s - WINDOW, c.s + WINDOW);
      if (d) tops.push({ s, i, k, d });
    }),
  );
  tops.forEach((t) => layers.push({ key: `g${t.i}-${t.k}`, d: t.d, stroke: background, width: ROPE_WIDTH + 9 }));
  tops.forEach((t) => {
    layers.push({ key: `x${t.i}-${t.k}`, d: t.d, stroke: t.s.outline, width: ROPE_WIDTH + 3 });
    layers.push({ key: `t${t.i}-${t.k}`, d: t.d, stroke: t.s.fill, width: ROPE_WIDTH });
  });
  return layers;
}

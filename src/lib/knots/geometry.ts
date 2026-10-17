/**
 * Rope geometry for the knot animations. A knot is a 3D curve (x, y across the picture,
 * z toward the viewer). Looking from the front, wherever the curve crosses itself the
 * strand with the larger z is on top, so over/under is always consistent with a real knot.
 */
export type P3 = { x: number; y: number; z: number };
export type Pt = { x: number; y: number; s: number }; // s = distance along the rope

export type Crossing = { s: number; x: number; y: number };

export type Rope = {
  points: Pt[];
  length: number;
  /** Where the rope passes OVER another strand (arc length along the rope). */
  overs: Crossing[];
  /** Total number of places the rope crosses itself in the picture. */
  crossings: number;
};

/** Evenly spaced points along a polyline of P3 (about `step` px apart). */
export function resample(raw: P3[], step = 2): P3[] {
  const out: P3[] = [raw[0]];
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let t = step - carry;
    while (t <= d) {
      const f = t / d;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
      t += step;
    }
    carry = d - (t - step);
  }
  out.push(raw[raw.length - 1]);
  return out;
}

/** Moving average over x and y (z is kept), to round off corners where the tails join the knot. */
export function blur(pts: P3[], radius: number): P3[] {
  return pts.map((p, i) => {
    let x = 0;
    let y = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const q = pts[i + k];
      if (!q) continue;
      x += q.x;
      y += q.y;
      n++;
    }
    // Keep the very ends where they are so the tails stay put.
    return i < radius || i >= pts.length - radius ? p : { x: x / n, y: y / n, z: p.z };
  });
}

/** Finds self-crossings (ignoring neighbours along the rope) and which strand is on top. */
export function analyse(raw: P3[], smooth = 0): Rope {
  const pts = smooth > 0 ? blur(resample(raw, 2), smooth) : resample(raw, 2);
  const points: Pt[] = [];
  let s = 0;
  pts.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    points.push({ x: p.x, y: p.y, s });
  });
  const overs: Crossing[] = [];
  let crossings = 0;
  const gap = 12; // neighbours closer than this along the rope don't count
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 1; j < pts.length - 1; j++) {
      if (points[j].s - points[i + 1].s < gap) continue;
      const hit = intersect(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (!hit) continue;
      crossings++;
      const zi = pts[i].z + (pts[i + 1].z - pts[i].z) * hit.t;
      const zj = pts[j].z + (pts[j + 1].z - pts[j].z) * hit.u;
      const over = zi >= zj ? { seg: i, f: hit.t } : { seg: j, f: hit.u };
      const sOver = points[over.seg].s + (points[over.seg + 1].s - points[over.seg].s) * over.f;
      overs.push({ s: sOver, x: hit.x, y: hit.y });
    }
  }
  overs.sort((a, b) => a.s - b.s);
  return { points, length: s, overs, crossings };
}

function intersect(a: P3, b: P3, c: P3, d: P3) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const q = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * q.y - r.y * q.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t < 0 || t >= 1 || u < 0 || u >= 1) return null;
  return { t, u, x: a.x + r.x * t, y: a.y + r.y * t };
}

/** Points of the rope between arc lengths [from, to], as an SVG path (polyline). */
export function pathBetween(rope: Rope, from: number, to: number): string {
  const pts = rope.points;
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.s < from) continue;
    if (p.s > to) {
      const prev = pts[i - 1];
      if (prev && prev.s >= from) {
        const f = (to - prev.s) / (p.s - prev.s);
        d += ` L${(prev.x + (p.x - prev.x) * f).toFixed(1)} ${(prev.y + (p.y - prev.y) * f).toFixed(1)}`;
      }
      break;
    }
    d += `${d ? ' L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
}

/** Shifts a P3 path sideways by `dist` (to draw a second strand running beside the first). */
export function offset(raw: P3[], dist: number): P3[] {
  return raw.map((p, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[Math.min(raw.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x + (-(b.y - a.y) / len) * dist, y: p.y + ((b.x - a.x) / len) * dist, z: p.z };
  });
}

/** An open knot from a closed parametric curve: cuts it at `cut` and adds straight tails. */
export function openKnot(
  curve: (t: number) => P3,
  opts: { cut: number; gap: number; tail: number; scale: number; cx: number; cy: number; spread?: number },
): P3[] {
  const { cut, gap, tail, scale, cx, cy, spread = 1 } = opts;
  const at = (t: number): P3 => {
    const p = curve(t);
    return { x: cx + p.x * scale, y: cy - p.y * scale, z: p.z * scale };
  };
  const pts: P3[] = [];
  const t0 = cut + gap;
  const t1 = cut - gap + Math.PI * 2;
  const n = 400;
  for (let i = 0; i <= n; i++) pts.push(at(t0 + ((t1 - t0) * i) / n));
  const first = pts[0];
  const second = pts[3];
  const last = pts[pts.length - 1];
  const beforeLast = pts[pts.length - 4];
  const dir = (a: P3, b: P3) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  // Tails leave outward from the knot, fanning apart so they stay clear of it.
  const away = (from: P3, to: P3, spread: number) => {
    const r = dir(centre, to);
    const a = dir(from, to);
    const x = r.x + a.x * spread;
    const y = r.y + a.y * spread;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  const centre = { x: cx, y: cy, z: 0 };
  const d0 = away(last, first, spread);
  const d1 = away(first, last, spread);
  void second;
  void beforeLast;
  return [
    { x: first.x + d0.x * tail, y: first.y + d0.y * tail, z: 0 },
    ...pts,
    { x: last.x + d1.x * tail, y: last.y + d1.y * tail, z: 0 },
  ];
}

/** Standard closed curves (Wikipedia parametrisations). */
export const trefoil = (t: number): P3 => ({
  x: Math.sin(t) + 2 * Math.sin(2 * t),
  y: Math.cos(t) - 2 * Math.cos(2 * t),
  z: -Math.sin(3 * t),
});
export const figureEight = (t: number): P3 => ({
  x: (2 + Math.cos(2 * t)) * Math.cos(3 * t),
  y: (2 + Math.cos(2 * t)) * Math.sin(3 * t),
  z: Math.sin(4 * t),
});

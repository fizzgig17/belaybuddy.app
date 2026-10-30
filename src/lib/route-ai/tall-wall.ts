/**
 * Tall walls: several LiDAR captures taken from one ARKit session (so their camera poses share a
 * world), stitched into one straightened picture of the wall. Pure math, no native code.
 *
 * The wall plane is fitted to the depth from all captures together (LiDAR only reaches about 5 m, so
 * the upper sections often have no depth; they still line up because ARKit tracks the camera pose
 * itself). Every section photo is then projected onto that plane, so the result is a flat, upright
 * view where one pixel is a fixed number of centimeters. Locating a hold is then simple arithmetic.
 *
 * Assumes the wall is one flat plane from bottom to top.
 */
import {
  bytes,
  cross,
  dot,
  fitPlane,
  floats,
  norm,
  rng,
  sub,
  type RawDepthCapture,
  type V3,
  type WallFailure,
  type WallGeometry,
} from './depth';

export type TallWallFit = {
  n: V3;
  /** A point on the wall. */
  p: V3;
  /** Along the wall to the right (as seen from the camera), and up the wall. */
  uAxis: V3;
  vAxis: V3;
  overhangDeg: number;
  fit: number;
  /** Wall extent in meters along uAxis / vAxis, as covered by the photos. */
  umin: number;
  umax: number;
  vmin: number;
  vmax: number;
};

/** A section photo decoded to pixels, in the same portrait orientation as the capture's `uri`. */
export type SectionImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

const col = (t: number[], i: number): V3 => [t[i * 4], t[i * 4 + 1], t[i * 4 + 2]];

const MAX_WIDTH_M = 10;
const MAX_HEIGHT_M = 16;
const MAX_RAY_M = 15;
/** Corners of a steeply tilted photo look along the wall (very far away), so only a cross through the middle sets the extent. */
const INNER = [0.05, 0.25, 0.5, 0.75, 0.95];

function worldPoints(cap: RawDepthCapture): V3[] {
  const depth = floats(cap.depth);
  const confidence = cap.confidence ? bytes(cap.confidence) : null;
  const { depthWidth: dw, depthHeight: dh } = cap;
  const t = cap.transform;
  if (t.length !== 16 || depth.length < dw * dh) return [];
  const [X, Y, Z, o] = [col(t, 0), col(t, 1), col(t, 2), col(t, 3)];
  const scale = dw / cap.imageWidth;
  const fx = cap.fx * scale;
  const fy = cap.fy * scale;
  const cx = cap.cx * scale;
  const cy = cap.cy * scale;
  const out: V3[] = [];
  for (let v = 0; v < dh; v += 2) {
    for (let u = 0; u < dw; u += 2) {
      const i = v * dw + u;
      const d = depth[i];
      if (!(d > 0.3 && d < 8)) continue;
      if (confidence && confidence[i] < 1) continue;
      const a = ((u + 0.5 - cx) / fx) * d;
      const b = (-(v + 0.5 - cy) / fy) * d;
      out.push([
        X[0] * a + Y[0] * b - Z[0] * d + o[0],
        X[1] * a + Y[1] * b - Z[1] * d + o[1],
        X[2] * a + Y[2] * b - Z[2] * d + o[2],
      ]);
    }
  }
  return out;
}

/** Where a ray from a capture's camera through sensor pixel (px, py) meets the plane, in meters along the wall. */
function hitPlane(cap: RawDepthCapture, px: number, py: number, plane: { n: V3; p: V3 }, uAxis: V3, vAxis: V3) {
  const t = cap.transform;
  const [X, Y, Z, o] = [col(t, 0), col(t, 1), col(t, 2), col(t, 3)];
  const rx = (px - cap.cx) / cap.fx;
  const ry = -(py - cap.cy) / cap.fy;
  const dir: V3 = [
    X[0] * rx + Y[0] * ry - Z[0],
    X[1] * rx + Y[1] * ry - Z[1],
    X[2] * rx + Y[2] * ry - Z[2],
  ];
  const denom = dot(dir, plane.n);
  if (Math.abs(denom) < 1e-6) return null;
  const s = dot(sub(plane.p, o), plane.n) / denom;
  if (!(s > 0) || s > MAX_RAY_M) return null;
  const hit: V3 = [o[0] + dir[0] * s, o[1] + dir[1] * s, o[2] + dir[2] * s];
  return { u: dot(hit, uAxis), v: dot(hit, vAxis) };
}

/** Fits one wall plane to all the captures and works out how much of the wall the photos cover. */
export function fitTallWall(caps: RawDepthCapture[]): { wall: TallWallFit } | { failure: WallFailure } {
  const points: V3[] = [];
  for (const cap of caps) for (const p of worldPoints(cap)) points.push(p);
  if (points.length < 400) return { failure: 'too-little-depth' };

  const rand = rng(11);
  let best: V3[] = [];
  for (let iter = 0; iter < 200; iter++) {
    const a = points[Math.floor(rand() * points.length)];
    const b = points[Math.floor(rand() * points.length)];
    const c = points[Math.floor(rand() * points.length)];
    const nrm = cross(sub(b, a), sub(c, a));
    if (Math.hypot(nrm[0], nrm[1], nrm[2]) < 1e-6) continue;
    const nn = norm(nrm);
    const inl = points.filter((q) => Math.abs(dot(sub(q, a), nn)) < 0.06);
    if (inl.length > best.length) best = inl;
  }
  if (best.length < 300) return { failure: 'too-little-depth' };
  const first = fitPlane(best);
  const near = points.filter((q) => Math.abs(dot(sub(q, first.p), first.n)) < 0.06);
  const plane = fitPlane(near.length >= 300 ? near : best);

  // Normal toward the cameras.
  const centre: V3 = [0, 0, 0];
  for (const cap of caps) {
    const o = col(cap.transform, 3);
    centre[0] += o[0] / caps.length;
    centre[1] += o[1] / caps.length;
    centre[2] += o[2] / caps.length;
  }
  let n = plane.n;
  if (dot(sub(centre, plane.p), n) < 0) n = [-n[0], -n[1], -n[2]];
  if (Math.abs(n[1]) > 0.95) return { failure: 'floor-or-ceiling' };

  const uAxis = norm(cross([0, 1, 0], n));
  const vAxis = cross(n, uAxis);
  const pl = { n, p: plane.p };

  // Extent: where the middle of every photo lands on the wall.
  let umin = Infinity;
  let umax = -Infinity;
  let vmin = Infinity;
  let vmax = -Infinity;
  let cu0 = Infinity;
  let cu1 = -Infinity;
  let cv0 = Infinity;
  let cv1 = -Infinity;
  for (const cap of caps) {
    const W = cap.imageWidth;
    const H = cap.imageHeight;
    // A cross through the middle of the photo (the corners of a steeply tilted shot graze the wall and land very far away).
    // Portrait left-right runs along the sensor's short side, portrait up-down along its long side.
    const samples: [number, number][] = [];
    for (const f of INNER) {
      samples.push([0.5 * W, f * H]);
      samples.push([f * W, 0.5 * H]);
    }
    const mid = hitPlane(cap, 0.5 * W, 0.5 * H, pl, uAxis, vAxis);
    if (mid) {
      cu0 = Math.min(cu0, mid.u);
      cu1 = Math.max(cu1, mid.u);
      cv0 = Math.min(cv0, mid.v);
      cv1 = Math.max(cv1, mid.v);
    }
    for (const [px, py] of samples) {
      const hit = hitPlane(cap, px, py, pl, uAxis, vAxis);
      if (!hit) continue;
      umin = Math.min(umin, hit.u);
      umax = Math.max(umax, hit.u);
      vmin = Math.min(vmin, hit.v);
      vmax = Math.max(vmax, hit.v);
    }
  }
  if (!(umax > umin && vmax > vmin)) return { failure: 'too-little-depth' };
  // A section can't show much more than a few meters around where its camera points; anything further out is a
  // grazing ray. This also keeps the picture a sane size.
  if (cu0 <= cu1) {
    umin = Math.max(umin, cu0 - 3.5);
    umax = Math.min(umax, cu1 + 3.5);
    vmin = Math.max(vmin, cv0 - 3);
    vmax = Math.min(vmax, cv1 + 3);
  }
  if (umax - umin > MAX_WIDTH_M) {
    const mid = (umax + umin) / 2;
    umin = mid - MAX_WIDTH_M / 2;
    umax = mid + MAX_WIDTH_M / 2;
  }
  if (vmax - vmin > MAX_HEIGHT_M) vmax = vmin + MAX_HEIGHT_M;
  if (!(umax > umin && vmax > vmin)) return { failure: 'too-little-depth' };

  return {
    wall: {
      n,
      p: plane.p,
      uAxis,
      vAxis,
      overhangDeg: (-Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180) / Math.PI,
      fit: near.length / points.length,
      umin,
      umax,
      vmin,
      vmax,
    },
  };
}

/** Pixel size (meters) for the stitched picture: about 4 mm, coarser if the wall is huge. */
export function mosaicScale(w: TallWallFit, maxPixels = 2.5e6): number {
  const area = (w.umax - w.umin) * (w.vmax - w.vmin);
  return Math.max(0.004, Math.sqrt(area / maxPixels));
}

/**
 * Projects the section photos onto the wall. Returns an upright RGBA picture where each pixel is
 * `scale` meters. `rowsDone` is called now and then so a screen can stay responsive.
 */
export async function buildMosaic(
  caps: RawDepthCapture[],
  images: SectionImage[],
  w: TallWallFit,
  scale: number,
  yieldEvery = 80,
): Promise<{ width: number; height: number; data: Uint8Array }> {
  const width = Math.max(1, Math.ceil((w.umax - w.umin) / scale));
  const height = Math.max(1, Math.ceil((w.vmax - w.vmin) / scale));
  const out = new Uint8Array(width * height * 4);

  const u0 = dot(w.p, w.uAxis);
  const v0 = dot(w.p, w.vAxis);
  // World point on the wall for output pixel (c, r): base + c*du + r*dv.
  const base: V3 = [
    w.p[0] + (w.umin + 0.5 * scale - u0) * w.uAxis[0] + (w.vmax - 0.5 * scale - v0) * w.vAxis[0],
    w.p[1] + (w.umin + 0.5 * scale - u0) * w.uAxis[1] + (w.vmax - 0.5 * scale - v0) * w.vAxis[1],
    w.p[2] + (w.umin + 0.5 * scale - u0) * w.uAxis[2] + (w.vmax - 0.5 * scale - v0) * w.vAxis[2],
  ];
  const du: V3 = [w.uAxis[0] * scale, w.uAxis[1] * scale, w.uAxis[2] * scale];
  const dv: V3 = [-w.vAxis[0] * scale, -w.vAxis[1] * scale, -w.vAxis[2] * scale];

  type Cam = { X: V3; Y: V3; Z: V3; o: V3; cap: RawDepthCapture; img: SectionImage };
  const cams: Cam[] = caps.map((cap, i) => ({
    X: col(cap.transform, 0),
    Y: col(cap.transform, 1),
    Z: col(cap.transform, 2),
    o: col(cap.transform, 3),
    cap,
    img: images[i],
  }));

  for (let r = 0; r < height; r++) {
    const rowBase: V3 = [base[0] + r * dv[0], base[1] + r * dv[1], base[2] + r * dv[2]];
    // Per camera: camera-space point = a + c * b, for this row.
    const rows = cams.map((k) => {
      const d0: V3 = [rowBase[0] - k.o[0], rowBase[1] - k.o[1], rowBase[2] - k.o[2]];
      return {
        a: [dot(k.X, d0), dot(k.Y, d0), dot(k.Z, d0)] as V3,
        b: [dot(k.X, du), dot(k.Y, du), dot(k.Z, du)] as V3,
      };
    });
    for (let c = 0; c < width; c++) {
      let bestW = 0;
      let bestK = -1;
      let bestX = 0;
      let bestY = 0;
      for (let ki = 0; ki < cams.length; ki++) {
        const row = rows[ki];
        const cz = row.a[2] + c * row.b[2];
        if (cz > -0.1) continue; // behind the camera
        const k = cams[ki];
        const cxs = row.a[0] + c * row.b[0];
        const cys = row.a[1] + c * row.b[1];
        const px = k.cap.cx + (k.cap.fx * cxs) / -cz;
        const py = k.cap.cy - (k.cap.fy * cys) / -cz;
        const nx = 1 - py / k.cap.imageHeight;
        const ny = px / k.cap.imageWidth;
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) continue;
        const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
        if (edge > bestW) {
          bestW = edge;
          bestK = ki;
          bestX = nx;
          bestY = ny;
        }
      }
      const o = (r * width + c) * 4;
      if (bestK < 0) {
        out[o] = out[o + 1] = out[o + 2] = 48;
        out[o + 3] = 255;
        continue;
      }
      const img = cams[bestK].img;
      const sx = bestX * (img.width - 1);
      const sy = bestY * (img.height - 1);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const y1 = Math.min(img.height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * img.width + x0) * 4;
      const i10 = (y0 * img.width + x1) * 4;
      const i01 = (y1 * img.width + x0) * 4;
      const i11 = (y1 * img.width + x1) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = img.data[i00 + ch] * (1 - fx) + img.data[i10 + ch] * fx;
        const bot = img.data[i01 + ch] * (1 - fx) + img.data[i11 + ch] * fx;
        out[o + ch] = top * (1 - fy) + bot * fy;
      }
      out[o + 3] = 255;
    }
    if (r % yieldEvery === yieldEvery - 1) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { width, height, data: out };
}

/** The same shape as a single-shot measurement, for a stitched picture: (nx, ny) are 0..1 over the picture. */
export function mosaicGeometry(w: TallWallFit): WallGeometry {
  return {
    overhangDeg: w.overhangDeg,
    fit: w.fit,
    locate(nx, ny) {
      return { x: (w.umin + nx * (w.umax - w.umin)) * 100, y: (w.vmax - ny * (w.vmax - w.vmin)) * 100 };
    },
  };
}

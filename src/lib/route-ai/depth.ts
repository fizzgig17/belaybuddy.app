/**
 * Wall geometry from a LiDAR capture (see modules/wall-depth). Pure math, no native code:
 * fits the wall plane to the depth points, reports how steep it is, and turns a spot on the
 * photo into centimeters on the wall.
 *
 * Conventions (ARKit): camera space has x to the right, y up, and the camera looks down -z.
 * `transform` (column-major 4x4) takes camera space to a gravity-aligned world where y is up.
 * The depth map and the camera intrinsics are in the sensor's landscape orientation; the saved
 * photo is that image turned 90° clockwise to portrait.
 */

export type RawDepthCapture = {
  uri: string;
  width: number;
  height: number;
  /** Float32 meters, row-major, base64. */
  depth: string;
  /** UInt8 (0 low, 1 medium, 2 high), same size as depth, base64. May be empty. */
  confidence: string;
  depthWidth: number;
  depthHeight: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  imageWidth: number;
  imageHeight: number;
  transform: number[];
};

export type V3 = [number, number, number];

export type WallGeometry = {
  /** Degrees past vertical toward the climber. Negative is a slab (leaning back). */
  overhangDeg: number;
  /** Share of the depth points that sit on the fitted wall, 0..1. Low means a messy scan. */
  fit: number;
  /** A spot on the portrait photo (0..1 from the left and top) as centimeters on the wall: x to the right, y up the wall. */
  locate(nx: number, ny: number): { x: number; y: number } | null;
  /**
   * Whether the spot on the photo is on the wall (within about half a meter of the fitted plane), as opposed to
   * the floor, mats, a ceiling, another wall or a person in front of it. Null when the scan has no depth there.
   */
  onWall?(nx: number, ny: number): boolean | null;
};

/** Holds and volumes stand out from the wall by less than this. */
export const ON_WALL_M = 0.6;

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function floats(b64: string): Float32Array {
  const raw = bytes(b64);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const out = new Float32Array(Math.floor(raw.length / 4));
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

/** Smallest-eigenvalue eigenvector of a symmetric 3x3 (the plane normal), by Jacobi rotations. */
function smallestEigenvector(m: number[][]): V3 {
  const a = m.map((row) => [...row]);
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let p = 0;
    let q = 1;
    let max = Math.abs(a[0][1]);
    if (Math.abs(a[0][2]) > max) { p = 0; q = 2; max = Math.abs(a[0][2]); }
    if (Math.abs(a[1][2]) > max) { p = 1; q = 2; max = Math.abs(a[1][2]); }
    if (max < 1e-14) break;
    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    for (let k = 0; k < 3; k++) {
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < 3; k++) {
      const apk = a[p][k];
      const aqk = a[q][k];
      a[p][k] = c * apk - s * aqk;
      a[q][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < 3; k++) {
      const vkp = v[k][p];
      const vkq = v[k][q];
      v[k][p] = c * vkp - s * vkq;
      v[k][q] = s * vkp + c * vkq;
    }
  }
  let best = 0;
  for (let i = 1; i < 3; i++) if (a[i][i] < a[best][best]) best = i;
  return [v[0][best], v[1][best], v[2][best]];
}

export function fitPlane(points: V3[]): { n: V3; p: V3 } {
  const c: V3 = [0, 0, 0];
  for (const p of points) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  c[0] /= points.length; c[1] /= points.length; c[2] /= points.length;
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j];
  }
  return { n: norm(smallestEigenvector(cov)), p: c };
}

/** Deterministic pseudo-random numbers so a scan always gives the same answer. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type WallFailure = 'too-little-depth' | 'floor-or-ceiling';

/** Same as analyseWall, but says why it failed so the screen can tell the person what to do. */
export function measureWall(cap: RawDepthCapture): { wall: WallGeometry } | { failure: WallFailure } {
  const result = analyse(cap);
  return 'wall' in result || 'failure' in result ? result : { failure: 'too-little-depth' };
}

export function analyseWall(cap: RawDepthCapture): WallGeometry | null {
  const result = analyse(cap);
  return 'wall' in result ? result.wall : null;
}

function analyse(cap: RawDepthCapture): { wall: WallGeometry } | { failure: WallFailure } {
  const depth = floats(cap.depth);
  const confidence = cap.confidence ? bytes(cap.confidence) : null;
  const { depthWidth: dw, depthHeight: dh } = cap;
  if (depth.length < dw * dh) return { failure: 'too-little-depth' };

  const t = cap.transform;
  if (t.length !== 16) return { failure: 'too-little-depth' };
  const col = (i: number): V3 => [t[i * 4], t[i * 4 + 1], t[i * 4 + 2]];
  const [X, Y, Z] = [col(0), col(1), col(2)];
  const origin: V3 = col(3);
  const toWorld = (c: V3): V3 => [
    X[0] * c[0] + Y[0] * c[1] + Z[0] * c[2] + origin[0],
    X[1] * c[0] + Y[1] * c[1] + Z[1] * c[2] + origin[1],
    X[2] * c[0] + Y[2] * c[1] + Z[2] * c[2] + origin[2],
  ];

  // Intrinsics are for the full image; the depth map is smaller.
  const scale = dw / cap.imageWidth;
  const fx = cap.fx * scale;
  const fy = cap.fy * scale;
  const cx = cap.cx * scale;
  const cy = cap.cy * scale;

  // World-space points from confident depth samples.
  const points: V3[] = [];
  for (let v = 0; v < dh; v += 2) {
    for (let u = 0; u < dw; u += 2) {
      const i = v * dw + u;
      const d = depth[i];
      if (!(d > 0.3 && d < 8)) continue;
      if (confidence && confidence[i] < 1) continue;
      points.push(toWorld([((u + 0.5 - cx) / fx) * d, (-(v + 0.5 - cy) / fy) * d, -d]));
    }
  }
  if (points.length < 200) return { failure: 'too-little-depth' };

  // RANSAC for the dominant plane (the wall), then refit to everything near it.
  const rand = rng(7);
  let bestInliers: V3[] = [];
  for (let iter = 0; iter < 150; iter++) {
    const a = points[Math.floor(rand() * points.length)];
    const b = points[Math.floor(rand() * points.length)];
    const c = points[Math.floor(rand() * points.length)];
    const n = cross(sub(b, a), sub(c, a));
    if (Math.hypot(...n) < 1e-6) continue;
    const nn = norm(n);
    const inliers = points.filter((p) => Math.abs(dot(sub(p, a), nn)) < 0.06);
    if (inliers.length > bestInliers.length) bestInliers = inliers;
  }
  if (bestInliers.length < 150) return { failure: 'too-little-depth' };
  const refit = fitPlane(bestInliers);
  const inliers = points.filter((p) => Math.abs(dot(sub(p, refit.p), refit.n)) < 0.06);
  const plane = fitPlane(inliers.length >= 150 ? inliers : bestInliers);

  // Point the normal toward the camera.
  let n = plane.n;
  if (dot(sub(origin, plane.p), n) < 0) n = [-n[0], -n[1], -n[2]];
  // Looking mostly at a floor or ceiling: there's no meaningful wall angle.
  if (Math.abs(n[1]) > 0.95) return { failure: 'floor-or-ceiling' };

  const up: V3 = [0, 1, 0];
  const uAxis = norm(cross(up, n)); // along the wall, to the right as seen from the camera
  const vAxis = cross(n, uAxis); // up the wall

  return {
    wall: {
    overhangDeg: (-Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180) / Math.PI,
    fit: inliers.length / points.length,
    onWall(nx, ny) {
      const u0 = Math.round(((ny * cap.imageWidth) * dw) / cap.imageWidth);
      const v0 = Math.round((((1 - nx) * cap.imageHeight) * dh) / cap.imageHeight);
      const ds: number[] = [];
      for (let dv = -2; dv <= 2; dv++) {
        for (let du = -2; du <= 2; du++) {
          const u = u0 + du;
          const v = v0 + dv;
          if (u < 0 || v < 0 || u >= dw || v >= dh) continue;
          const i = v * dw + u;
          if (!(depth[i] > 0.3 && depth[i] < 8)) continue;
          if (confidence && confidence[i] < 1) continue;
          ds.push(depth[i]);
        }
      }
      if (ds.length < 4) return null;
      ds.sort((p, q) => p - q);
      const d = ds[Math.floor(ds.length / 2)];
      const P = toWorld([((u0 + 0.5 - cx) / fx) * d, (-(v0 + 0.5 - cy) / fy) * d, -d]);
      return Math.abs(dot(sub(P, plane.p), n)) < ON_WALL_M;
    },
    locate(nx, ny) {
      // Portrait (nx, ny) back to the landscape sensor image: lu = ny, lv = 1 - nx.
      const px = ny * cap.imageWidth;
      const py = (1 - nx) * cap.imageHeight;
      const rc: V3 = [(px - cap.cx) / cap.fx, -(py - cap.cy) / cap.fy, -1];
      const dir: V3 = [
        X[0] * rc[0] + Y[0] * rc[1] + Z[0] * rc[2],
        X[1] * rc[0] + Y[1] * rc[1] + Z[1] * rc[2],
        X[2] * rc[0] + Y[2] * rc[1] + Z[2] * rc[2],
      ];
      const denom = dot(dir, n);
      if (Math.abs(denom) < 1e-6) return null;
      const s = dot(sub(plane.p, origin), n) / denom;
      if (s <= 0) return null;
      const hit: V3 = [origin[0] + dir[0] * s, origin[1] + dir[1] * s, origin[2] + dir[2] * s];
      return { x: dot(hit, uAxis) * 100, y: dot(hit, vAxis) * 100 };
    },
  },
  };
}

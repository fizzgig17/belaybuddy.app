import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { RawDepthCapture } from './depth';
import type { Segment } from './segment';

type WallDepthNative = {
  isSupported(): boolean;
  capture(): Promise<RawDepthCapture>;
  captureSections(): Promise<{ shots: RawDepthCapture[] }>;
  instanceMask(uri: string, maxEdge: number): Promise<{ width: number; height: number; data: string } | null>;
  canSegment(): boolean;
  segmenterReport(uri: string): Promise<string>;
  segmentHolds(uri: string, points: number[][]): Promise<Record<string, unknown>[] | null>;
};

/** The native module only exists in iOS builds that include modules/wall-depth. */
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<WallDepthNative>('WallDepth') : null;

/** True on iPhones and iPads with a LiDAR scanner, in a build that includes the scanner. */
export function isLidarSupported(): boolean {
  try {
    return !!native?.isSupported();
  } catch {
    return false;
  }
}

/** Opens the LiDAR camera. Resolves null if the person closes it. */
export async function captureWall(): Promise<RawDepthCapture | null> {
  if (!native) return null;
  try {
    return await native.capture();
  } catch (e) {
    if ((e as { code?: string }).code === 'E_CANCELED') return null;
    throw e;
  }
}

/**
 * Opens the LiDAR camera for a tall wall: the person takes several shots from the bottom up in one
 * session (so the phone's position is tracked between them) and taps Done. Null if they cancel.
 */
export async function captureWallSections(): Promise<RawDepthCapture[] | null> {
  if (!native) return null;
  try {
    const { shots } = await native.captureSections();
    return shots.length > 0 ? shots : null;
  } catch (e) {
    if ((e as { code?: string }).code === 'E_CANCELED') return null;
    throw e;
  }
}

export type ObjectMask = { width: number; height: number; labels: Uint8Array };

/**
 * Apple Vision's separate-objects finder (iPhone, iOS 17 and later, on the phone): every pixel is labeled with the
 * object it belongs to, 0 for background. Null anywhere it isn't available, and the app uses colors alone.
 */
export async function findObjects(uri: string, maxEdge = 640): Promise<ObjectMask | null> {
  if (!native) return null;
  try {
    const r = await native.instanceMask(uri, maxEdge);
    if (!r) return null;
    const bin = atob(r.data);
    const labels = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) labels[i] = bin.charCodeAt(i);
    return labels.length === r.width * r.height ? { width: r.width, height: r.height, labels } : null;
  } catch {
    return null;
  }
}

/** Whether this build carries the on-phone segmentation model (iPhone builds only). */
export function canSegmentHolds(): boolean {
  try {
    return !!native?.canSegment?.();
  } catch {
    return false;
  }
}

/**
 * Cuts out the object under each point (x, y in 0..1) with the on-phone "segment anything" model. One entry per
 * point, null where nothing was found; null overall if the model could not run, so callers fall back to colors.
 */
export async function segmentHolds(uri: string, points: [number, number][]): Promise<(Segment | null)[] | null> {
  if (!native || points.length === 0) return null;
  try {
    const raw = await native.segmentHolds(uri, points);
    if (!raw) return null;
    return raw.map((r) =>
      typeof r.x0 === 'number' && typeof r.grid === 'string' ? (r as unknown as Segment) : null,
    );
  } catch {
    return null;
  }
}

/** A short account of what the on-phone segmentation model did with this photo (for diagnosing it). */
export async function segmenterReport(uri: string): Promise<string> {
  if (!native?.segmenterReport) return 'This build has no segmentation model.';
  try {
    return await native.segmenterReport(uri);
  } catch (e) {
    return `Report failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

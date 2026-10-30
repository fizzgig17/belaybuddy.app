/**
 * Phone side of tall-wall scanning: decodes the section photos, stitches them with tall-wall.ts and
 * saves the result as a normal wall photo that the rest of Route AI can use unchanged.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import jpeg from 'jpeg-js';

import type { RawDepthCapture, WallFailure, WallGeometry } from './depth';
import { buildMosaic, fitTallWall, mosaicGeometry, mosaicScale, type SectionImage } from './tall-wall';

/** Portrait width each section is decoded at. About 4 mm per pixel on a wall 3 m back. */
const SECTION_WIDTH = 720;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decodeSection(uri: string): Promise<SectionImage> {
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: SECTION_WIDTH } }], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error('Could not read a section photo.');
  const decoded = jpeg.decode(base64ToBytes(small.base64), { useTArray: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

/** jpeg-js's encoder reaches for Node's Buffer when it runs under a bundler; the phone has none. */
function encodeJpeg(image: { data: Uint8Array; width: number; height: number }, quality: number): Uint8Array {
  const g = globalThis as unknown as { Buffer?: { from(a: ArrayLike<number>): Uint8Array } };
  const had = g.Buffer;
  if (!had) g.Buffer = { from: (a) => Uint8Array.from(a) };
  try {
    return jpeg.encode(image, quality).data as unknown as Uint8Array;
  } finally {
    if (!had) delete g.Buffer;
  }
}

export type StitchResult =
  | { ok: true; uri: string; geometry: WallGeometry; heightM: number }
  | { ok: false; failure: WallFailure };

/** Stitches the section captures into one upright picture of the wall. */
export async function stitchTallWall(caps: RawDepthCapture[]): Promise<StitchResult> {
  const fit = fitTallWall(caps);
  if ('failure' in fit) return { ok: false, failure: fit.failure };
  const images: SectionImage[] = [];
  for (const cap of caps) images.push(await decodeSection(cap.uri));
  const scale = mosaicScale(fit.wall);
  const mosaic = await buildMosaic(caps, images, fit.wall, scale);
  const bytes = encodeJpeg({ data: mosaic.data, width: mosaic.width, height: mosaic.height }, 85);
  const file = new File(Paths.cache, `tall-wall-${Date.now()}.jpg`);
  file.create({ overwrite: true });
  file.write(bytes);
  return { ok: true, uri: file.uri, geometry: mosaicGeometry(fit.wall), heightM: fit.wall.vmax - fit.wall.vmin };
}

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import jpeg from 'jpeg-js';

import type { Pixels } from './detect';

export type WallPhoto = {
  /** Display image (resized, orientation fixed). */
  uri: string;
  width: number;
  height: number;
  /** Small copy decoded for detection. */
  pixels: Pixels;
};

const DISPLAY_WIDTH = 1280;
const DETECT_WIDTH = 960;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Resizes a picked photo and decodes a small copy to pixels. Never uploads anything. */
export async function loadWallPhoto(uri: string): Promise<WallPhoto> {
  const display = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: DISPLAY_WIDTH } }], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const small = await ImageManipulator.manipulateAsync(display.uri, [{ resize: { width: DETECT_WIDTH } }], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error('Could not read the photo.');
  const decoded = jpeg.decode(base64ToBytes(small.base64), { useTArray: true });
  return {
    uri: display.uri,
    width: display.width,
    height: display.height,
    pixels: { width: decoded.width, height: decoded.height, data: decoded.data },
  };
}

export type PickResult = { photo: WallPhoto } | { error: string } | null;

async function finish(result: ImagePicker.ImagePickerResult): Promise<PickResult> {
  if (result.canceled || !result.assets[0]) return null;
  try {
    return { photo: await loadWallPhoto(result.assets[0].uri) };
  } catch {
    return { error: 'That photo could not be opened. Try another.' };
  }
}

export async function takeWallPhoto(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { error: 'Camera access is off. You can turn it on in Settings, or choose a photo instead.' };
  return finish(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false }));
}

export async function chooseWallPhoto(): Promise<PickResult> {
  return finish(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false }));
}

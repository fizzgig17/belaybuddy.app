import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { RawDepthCapture } from './depth';

type WallDepthNative = {
  isSupported(): boolean;
  capture(): Promise<RawDepthCapture>;
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

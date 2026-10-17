import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

import type { Hold } from './detect';
import type { WallGeometry } from './depth';
import type { WallPhoto } from './photo';

export type NumberedHold = Hold & { n: number };

export type HoldTip = {
  n: number;
  type: 'jug' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'edge' | 'volume' | 'foot' | 'unclear' | 'not_a_hold';
  tip: string;
  foot: boolean;
};

export type RouteTips = { overview: string; order: number[]; holds: HoldTip[]; caveats: string };

/** Numbers holds from the bottom of the photo up, left to right on ties. */
export function numberHolds(holds: Hold[]): NumberedHold[] {
  return [...holds]
    .sort((a, b) => (Math.abs(b.y - a.y) > 0.02 ? b.y - a.y : a.x - b.x))
    .map((h, i) => ({ ...h, n: i + 1 }));
}

export const MAX_TIP_HOLDS = 60;

async function sendableImage(photo: WallPhoto): Promise<string> {
  const small = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 1024 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error('Could not prepare the photo.');
  return small.base64;
}

/** Asks the route-tips function for technique tips. Throws an Error with a message safe to show. */
export async function fetchRouteTips(
  photo: WallPhoto,
  holds: NumberedHold[],
  wall?: WallGeometry | null,
): Promise<RouteTips> {
  const image = await sendableImage(photo);
  // With a LiDAR scan, give each hold real wall coordinates (cm), measured from the lowest hold.
  const located = wall ? holds.map((h) => wall.locate(h.x, h.y)) : [];
  const base = located[0];
  const { data, error } = await supabase.functions.invoke<RouteTips>('route-tips', {
    body: {
      image,
      holds: holds.map((h, i) => {
        const at = located[i];
        return {
          n: h.n,
          x: h.x,
          y: h.y,
          w: h.w,
          h: h.h,
          ...(at && base ? { xCm: at.x - base.x, yCm: at.y - base.y } : {}),
        };
      }),
      ...(wall ? { wall: { overhangDeg: wall.overhangDeg } } : {}),
    },
  });
  if (error) {
    // Functions errors carry the response; its JSON has a friendly message.
    const context = (error as { context?: Response }).context;
    let message = 'Could not get tips. Check your connection and try again.';
    try {
      const body = await context?.json();
      if (body?.error) message = String(body.error);
    } catch {
      // Keep the default message.
    }
    throw new Error(message);
  }
  if (!data?.holds) throw new Error('Could not get tips. Try again.');
  return data;
}

export const HOLD_TYPE_LABEL: Record<HoldTip['type'], string> = {
  jug: 'Jug',
  crimp: 'Crimp',
  sloper: 'Sloper',
  pinch: 'Pinch',
  pocket: 'Pocket',
  edge: 'Edge',
  volume: 'Volume',
  foot: 'Foothold',
  unclear: 'Unclear',
  not_a_hold: 'Not a hold',
};

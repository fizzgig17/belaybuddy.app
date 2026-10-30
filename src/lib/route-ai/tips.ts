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

export type RouteTips = { overview: string; order: number[]; holds: HoldTip[]; caveats: string; unsafe?: boolean };

export type PhotoCheck = { kind: 'climbing_wall' | 'other' | 'unsafe' | 'unknown'; what: string };

/** Numbers holds from the bottom of the photo up, left to right on ties. */
export function numberHolds(holds: Hold[]): NumberedHold[] {
  return [...holds]
    .sort((a, b) => (Math.abs(b.y - a.y) > 0.02 ? b.y - a.y : a.x - b.x))
    .map((h, i) => ({ ...h, n: i + 1 }));
}

export const MAX_TIP_HOLDS = 60;

async function sendableImage(photo: WallPhoto, maxWidth = 1024): Promise<string> {
  // A stitched tall wall is much taller than a phone photo; keep the pixel count (and upload size) about the same.
  const width = Math.min(maxWidth, Math.floor(Math.sqrt((maxWidth * maxWidth * (4 / 3) * photo.width) / photo.height)));
  const small = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error('Could not prepare the photo.');
  return small.base64;
}

/** Quick look at what a photo shows, before it is displayed or used. Never throws: an unknown result means "carry on". */
export async function checkPhoto(photo: WallPhoto): Promise<PhotoCheck> {
  try {
    const image = await sendableImage(photo, 512);
    const { data, error } = await supabase.functions.invoke<PhotoCheck>('route-tips', { body: { mode: 'check', image } });
    if (error || !data?.kind) return { kind: 'unknown', what: '' };
    return data;
  } catch {
    return { kind: 'unknown', what: '' };
  }
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
  if (data?.unsafe) return { overview: '', order: [], holds: [], caveats: '', unsafe: true };
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

export type TipReportReason = 'wrong-or-unsafe' | 'offensive' | 'off-topic' | 'other';

export const TIP_REPORT_REASONS: { value: TipReportReason; label: string }[] = [
  { value: 'wrong-or-unsafe', label: 'Wrong or unsafe' },
  { value: 'offensive', label: 'Offensive' },
  { value: 'off-topic', label: 'Not about climbing' },
  { value: 'other', label: 'Something else' },
];

/** Reports AI-generated tips for review. Sends the tip text only, never the photo. */
export async function reportTips(tips: RouteTips, reason: TipReportReason, details: string) {
  const { error } = await supabase.from('ai_reports').insert({
    kind: 'route-tip',
    reason,
    details: details.trim() || null,
    content: JSON.stringify(tips).slice(0, 8000),
  });
  if (error) throw error;
}

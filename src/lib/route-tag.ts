import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { BOULDER_GRADES, ROUTE_GRADES, type Discipline } from '@/lib/climb-log';
import { supabase } from '@/lib/supabase';

export type TagRead = { discipline: Discipline; grade: string; mod: '' | '-' | '+'; color: string; name: string; setter: string };
export type TagResult = { tag: TagRead } | { error: string } | null;

/** Turns a grade as printed on a tag ("5.10+", "V3-4", "5.9") into one of the logger's buttons plus a minus/plus. */
export function parseGrade(raw: string): { discipline: Discipline; grade: string; mod: '' | '-' | '+' } | null {
  const t = raw.trim().replace(/\s+/g, '').replace('−', '-');
  const v = /^V(B|\d{1,2})/i.exec(t);
  if (v) {
    const g = `V${v[1].toUpperCase()}`;
    if (!BOULDER_GRADES.includes(g)) return null;
    const mod = /^V\d{1,2}\+$/i.test(t) ? '+' : /^V\d{1,2}-$/i.test(t) ? '-' : '';
    return { discipline: 'boulder', grade: g, mod };
  }
  const r = /^5\.(\d{1,2})([abcd])?([+-])?/i.exec(t);
  if (!r) return null;
  const n = Number(r[1]);
  if (n < 5 || n > 13) return null;
  const letter = r[2]?.toLowerCase();
  const sign = (r[3] ?? '') as '' | '-' | '+';
  if (n <= 9) {
    const g = `5.${Math.max(5, n)}`;
    return ROUTE_GRADES.includes(g) ? { discipline: 'route', grade: g, mod: sign } : null;
  }
  // 5.10 and up use letters; "5.10+" and "5.10-" mean the top and bottom of the range.
  const l = letter ?? (sign === '+' ? 'd' : sign === '-' ? 'a' : 'b');
  const g = `5.${n}${l}`;
  return ROUTE_GRADES.includes(g) ? { discipline: 'route', grade: g, mod: letter ? sign : '' } : null;
}

/** Opens the camera on a route tag and asks the AI to read it. Never throws. */
export async function scanRouteTag(): Promise<TagResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { error: 'Camera access is off. You can turn it on in Settings.' };
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (shot.canceled || !shot.assets[0]) return null;
    const small = await ImageManipulator.manipulateAsync(shot.assets[0].uri, [{ resize: { width: 1280 } }], {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!small.base64) return { error: 'Could not prepare the photo.' };
    const { data, error } = await supabase.functions.invoke<{
      found: boolean;
      unsafe?: boolean;
      grade?: string;
      color?: string;
      name?: string;
      setter?: string;
    }>('route-tips', { body: { mode: 'tag', image: small.base64 } });
    if (error) {
      let message = 'Could not read the tag. Check your connection and try again.';
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) message = String(body.error);
      } catch {
        // Keep the default message.
      }
      return { error: message };
    }
    if (!data?.found || !data.grade) return { error: 'Could not read a grade on that tag. Try again closer, or pick the grade yourself.' };
    const g = parseGrade(data.grade);
    if (!g) return { error: `Read “${data.grade}”, which isn’t a grade the log has. Pick the grade yourself.` };
    return { tag: { ...g, color: data.color ?? '', name: data.name ?? '', setter: data.setter ?? '' } };
  } catch {
    return { error: 'Could not scan the tag. Try again.' };
  }
}

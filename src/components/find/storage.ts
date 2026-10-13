/**
 * Remembers the last place searched on Find, so reopening the app shows the
 * same results. Uses localStorage (the browser's on web; expo-sqlite's
 * implementation on native, installed by lib/supabase.ts). Failures are
 * ignored: this is a convenience only.
 */
import type { Place } from '@/lib/location';

const KEY = 'bb.find.lastPlace';

export function loadLastPlace(): Place | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Place;
    return typeof p?.point?.latitude === 'number' && typeof p?.label === 'string' ? p : null;
  } catch {
    return null;
  }
}

export function saveLastPlace(place: Place) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(place));
  } catch {
    // ignore
  }
}

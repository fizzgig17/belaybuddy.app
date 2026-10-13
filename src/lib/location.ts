import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { LatLng } from '@/types/models';

export type Place = {
  point: LatLng;
  /** Short human label, e.g. "Raleigh, North Carolina". */
  label: string;
};

export class LocationDeniedError extends Error {
  constructor() {
    super('Location permission was not granted.');
  }
}

/** Current device position. Throws LocationDeniedError if the user says no. */
export async function getDeviceLocation(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocationDeniedError();

  // A recent cached fix is plenty for "what's near me" and much faster.
  const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000, requiredAccuracy: 1000 }).catch(
    () => null,
  );
  const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
}

// --- Place search (OpenStreetMap Nominatim) ---------------------------------
// Usage policy: max ~1 request/second, no search-as-you-type, identify the app.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'BelayBuddy/0.1 (https://belaybuddy.app)' };

type NominatimResult = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
};

function shortLabel(r: NominatimResult): string {
  const a = r.address ?? {};
  const town = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.county ?? r.name;
  const region = a.state ?? a.region ?? a.country;
  if (town && region && town !== region) return `${town}, ${region}`;
  return town ?? r.display_name.split(',').slice(0, 2).join(',');
}

/** Search for a city, park or address. Call on submit only. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Place search failed (${res.status}).`);
  const results = (await res.json()) as NominatimResult[];
  return results.map((r) => ({
    point: { latitude: Number(r.lat), longitude: Number(r.lon) },
    label: shortLabel(r),
  }));
}

/** Best-effort "Raleigh, North Carolina" label for a point; null on failure. */
export async function describePoint(point: LatLng): Promise<string | null> {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${point.latitude}&lon=${point.longitude}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    return shortLabel((await res.json()) as NominatimResult);
  } catch {
    return null;
  }
}

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

  // "What's near me" only needs to be right within a few km: take a recent
  // cached fix if there is one, otherwise a quick low-accuracy fix.
  const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000, requiredAccuracy: 3000 }).catch(
    () => null,
  );
  const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
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

const ZIPPOPOTAM = 'https://api.zippopotam.us';
const US_ZIP = /^(\d{5})(?:-\d{4})?$/;
const CA_POSTAL = /^([A-Za-z]\d[A-Za-z])[ -]?\d[A-Za-z]\d$/;

type ZippoResponse = {
  places?: { 'place name': string; state: string; 'state abbreviation'?: string; latitude: string; longitude: string }[];
};

/** US zip and Canadian postal codes. Free, no key; null when unknown or unreachable. */
async function lookupPostalCode(country: 'us' | 'ca', code: string): Promise<Place[] | null> {
  try {
    const res = await fetch(`${ZIPPOPOTAM}/${country}/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ZippoResponse;
    const places = (data.places ?? [])
      .map((p) => ({
        point: { latitude: Number(p.latitude), longitude: Number(p.longitude) },
        label: `${p['place name']}, ${p.state}`,
      }))
      .filter((p) => Number.isFinite(p.point.latitude) && Number.isFinite(p.point.longitude));
    return places.length ? places : null;
  } catch {
    return null;
  }
}

async function nominatim(params: string): Promise<Place[]> {
  const res = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Place search failed (${res.status}).`);
  const results = (await res.json()) as NominatimResult[];
  return results.map((r) => ({
    point: { latitude: Number(r.lat), longitude: Number(r.lon) },
    label: shortLabel(r),
  }));
}

/**
 * Search for a city, park, address or postal code. Call on submit only.
 * A bare zip code in a free-text search often finds nothing, so zip and postal
 * codes go to a postal-code lookup first, then to Nominatim's postal-code search.
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  const zip = q.match(US_ZIP);
  if (zip) {
    const hit = await lookupPostalCode('us', zip[1]);
    if (hit) return hit;
    const found = await nominatim(`postalcode=${zip[1]}&countrycodes=us`);
    if (found.length) return found;
  }
  const ca = q.match(CA_POSTAL);
  if (ca) {
    const hit = await lookupPostalCode('ca', ca[1].toUpperCase());
    if (hit) return hit;
  }
  const found = await nominatim(`q=${encodeURIComponent(q)}`);
  if (found.length === 0 && /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(q) && /\d/.test(q)) {
    // Looks like a postal code from somewhere else.
    return nominatim(`postalcode=${encodeURIComponent(q)}`);
  }
  return found;
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

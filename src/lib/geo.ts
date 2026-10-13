import type { LatLng } from '@/types/models';

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.609344;

/** Great-circle distance in kilometers. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "0.4 mi" / "12 mi" — miles, since the app is US-first. */
export function formatDistance(km: number): string {
  const miles = km / KM_PER_MILE;
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function milesToKm(miles: number) {
  return miles * KM_PER_MILE;
}

/** Bounding box [west, south, east, north] around a point. */
export function bboxAround(center: LatLng, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));
  return [center.longitude - dLng, center.latitude - dLat, center.longitude + dLng, center.latitude + dLat];
}

/**
 * Rounds a position to roughly 1 km so we never store or share anyone's exact
 * location (used for partner listings and cache keys).
 */
export function coarsen(point: LatLng, decimals = 2): LatLng {
  const f = 10 ** decimals;
  return { latitude: Math.round(point.latitude * f) / f, longitude: Math.round(point.longitude * f) / f };
}

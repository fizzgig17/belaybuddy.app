/**
 * Climbing shops and outdoor stores near a point, from OpenStreetMap.
 * OSM says a place is an outdoor or sports store (and sometimes that it sells
 * climbing gear); it doesn't know what's in stock.
 */
import { osmAddress, queryOverpass } from '@/lib/areas';
import { distanceKm } from '@/lib/geo';
import type { LatLng } from '@/types/models';

export type Shop = {
  id: string;
  name: string;
  location: LatLng;
  address?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  /** Tagged in OSM as selling climbing gear (or named like a climbing shop). */
  climbing: boolean;
  distanceKm: number;
};

const CLIMBING_NAME = /climb|boulder|mountain|alpine|vertical|summit|outfitter/i;

export async function fetchShops(center: LatLng, radiusKm: number): Promise<Shop[]> {
  const at = `(around:${Math.round(radiusKm * 1000)},${center.latitude},${center.longitude})`;
  // Exact tag values keep this fast on the shared Overpass servers.
  const query = `[out:json][timeout:15];(
    nwr["shop"="outdoor"]${at};
    nwr["shop"="sports"]["sport"="climbing"]${at};
    nwr["shop"="sports"]["sport"="bouldering"]${at};
    nwr["shop"="climbing"]${at};
  );out center tags 300;`;
  const elements = await queryOverpass(query);
  const seen = new Set<string>();
  const shops: Shop[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!t.name || lat == null || lon == null) continue;
    const id = `osm:${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const location = { latitude: lat, longitude: lon };
    shops.push({
      id,
      name: t.name,
      location,
      address: osmAddress(t),
      website: t.website ?? t['contact:website'],
      phone: t.phone ?? t['contact:phone'],
      openingHours: t.opening_hours,
      climbing: /climbing|bouldering/.test(t.sport ?? '') || t.shop === 'climbing' || CLIMBING_NAME.test(t.name),
      distanceKm: distanceKm(center, location),
    });
  }
  // Climbing shops first, then nearest.
  return shops.sort((a, b) => Number(b.climbing) - Number(a.climbing) || a.distanceKm - b.distanceKm);
}

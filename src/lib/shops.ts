/**
 * Climbing shops and outdoor stores near a point, from OpenStreetMap.
 * OSM says a place is an outdoor or sports store (and sometimes that it sells
 * climbing gear); it doesn't know what's in stock.
 */
import { osmAddress, queryOverpass } from '@/lib/areas';
import { coarsen, distanceKm } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
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

type ShopRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  climbing: boolean;
};

const byRelevance = (a: Shop, b: Shop) => Number(b.climbing) - Number(a.climbing) || a.distanceKm - b.distanceKm;

/** Shops from our own catalog (seeded for popular areas). Empty if the area isn't seeded. */
async function fetchShopCatalog(center: LatLng, radiusKm: number): Promise<Shop[]> {
  const { data, error } = await supabase.rpc('nearby_shops', {
    p_lat: center.latitude,
    p_lng: center.longitude,
    p_radius_km: radiusKm,
    p_limit: 300,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ShopRow[]).map((r) => {
    const location = { latitude: r.latitude, longitude: r.longitude };
    return {
      id: r.id,
      name: r.name,
      location,
      address: r.address ?? undefined,
      website: r.website ?? undefined,
      phone: r.phone ?? undefined,
      openingHours: r.opening_hours ?? undefined,
      climbing: r.climbing,
      distanceKm: distanceKm(center, location),
    };
  }).sort(byRelevance);
}

/** Catalog first (instant); live OpenStreetMap for places we haven't seeded, with one retry. */
export async function fetchShops(center: LatLng, radiusKm: number): Promise<Shop[]> {
  try {
    const saved = await fetchShopCatalog(center, radiusKm);
    if (saved.length > 0) return saved;
  } catch {
    // fall through to the live lookup
  }
  try {
    return await fetchShopsLive(center, radiusKm);
  } catch {
    return fetchShopsLive(center, radiusKm);
  }
}

async function fetchShopsLive(center: LatLng, radiusKm: number): Promise<Shop[]> {
  // A coarse spot (about 10 km) and a wider radius, trimmed below, so the exact position never leaves the phone.
  const spot = coarsen(center, 1);
  const at = `(around:${Math.round((radiusKm + 8) * 1000)},${spot.latitude},${spot.longitude})`;
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
  return shops.filter((x) => x.distanceKm <= radiusKm).sort(byRelevance);
}

/**
 * Finding climbing areas near a point.
 *   Gyms  — OpenStreetMap via the Overpass API (© OpenStreetMap contributors, ODbL)
 *   Crags — OpenBeta (openbeta.io), the open climbing route database
 * Both are free community services: results are cached per rounded location
 * so browsing back and forth doesn't re-query them.
 */
import { Platform } from 'react-native';

import { bboxAround, coarsen, distanceKm } from '@/lib/geo';
import type { ClimbingArea, ClimbingStyle, LatLng } from '@/types/models';

export type NearbyArea = ClimbingArea & { distanceKm: number };

const UA: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'BelayBuddy/0.1 (https://belaybuddy.app)' };

// --- Cache -------------------------------------------------------------------
const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; data: ClimbingArea[] }>();

async function cached(key: string, load: () => Promise<ClimbingArea[]>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

const cacheKey = (kind: string, center: LatLng, radiusKm: number) => {
  const c = coarsen(center, 2);
  return `${kind}:${c.latitude},${c.longitude}:${radiusKm}`;
};

// --- Gyms (OpenStreetMap / Overpass) -----------------------------------------
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function osmAddress(t: Record<string, string>): string | undefined {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const parts = [street, t['addr:city']].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function osmStyles(t: Record<string, string>): ClimbingStyle[] {
  const sport = t.sport ?? '';
  const styles = new Set<ClimbingStyle>();
  if (/bouldering/.test(sport) || t['climbing:boulder'] === 'yes') styles.add('bouldering');
  if (t['climbing:toprope'] === 'yes') styles.add('top-rope');
  if (t['climbing:sport'] === 'yes') styles.add('lead');
  return [...styles];
}

async function queryOverpass(query: string): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } catch (e) {
      lastError = e; // try the next mirror
    }
  }
  throw lastError;
}

export function fetchGyms(center: LatLng, radiusKm: number): Promise<ClimbingArea[]> {
  return cached(cacheKey('gyms', center, radiusKm), async () => {
    const r = Math.round(radiusKm * 1000);
    const at = `(around:${r},${center.latitude},${center.longitude})`;
    // Indoor climbing: sport=climbing on a gym-like place. Outdoor crags are
    // also tagged sport=climbing in OSM, so require an indoor-ish tag.
    const query = `[out:json][timeout:20];(
      nwr["sport"~"climbing|bouldering"]["leisure"~"^(sports_centre|fitness_centre|sports_hall)$"]${at};
      nwr["sport"~"climbing|bouldering"]["indoor"="yes"]${at};
      nwr["sport"~"climbing|bouldering"]["building"]${at};
    );out center tags 200;`;
    const elements = await queryOverpass(query);
    const seen = new Set<string>();
    const gyms: ClimbingArea[] = [];
    for (const el of elements) {
      const t = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!t.name || lat == null || lon == null) continue;
      const id = `osm:${el.type}/${el.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      gyms.push({
        id,
        kind: 'gym',
        name: t.name,
        location: { latitude: lat, longitude: lon },
        address: osmAddress(t),
        styles: osmStyles(t),
        source: 'osm',
        sourceId: `${el.type}/${el.id}`,
        website: t.website ?? t['contact:website'],
      });
    }
    return gyms;
  });
}

// --- Crags (OpenBeta) ----------------------------------------------------------
const OPENBETA = 'https://api.openbeta.io/';

type OpenBetaArea = {
  uuid: string;
  areaName: string;
  totalClimbs: number;
  pathTokens: string[];
  metadata: { lat: number | null; lng: number | null; isBoulder: boolean | null };
};

export function fetchCrags(center: LatLng, radiusKm: number): Promise<ClimbingArea[]> {
  return cached(cacheKey('crags', center, radiusKm), async () => {
    const query = `query Crags($bbox: [Float]) {
      cragsWithin(filter: { bbox: $bbox, zoom: 14 }) {
        uuid areaName totalClimbs pathTokens
        metadata { lat lng isBoulder }
      }
    }`;
    const res = await fetch(OPENBETA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...UA },
      body: JSON.stringify({ query, variables: { bbox: bboxAround(center, radiusKm) } }),
    });
    if (!res.ok) throw new Error(`OpenBeta returned ${res.status}`);
    const json = (await res.json()) as { data?: { cragsWithin: OpenBetaArea[] }; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return (json.data?.cragsWithin ?? [])
      .filter((a) => a.metadata.lat != null && a.metadata.lng != null && a.totalClimbs > 0)
      .map((a) => ({
        id: `openbeta:${a.uuid}`,
        kind: 'crag' as const,
        name: a.areaName,
        location: { latitude: a.metadata.lat!, longitude: a.metadata.lng! },
        styles: a.metadata.isBoulder ? (['bouldering'] as ClimbingStyle[]) : [],
        source: 'openbeta' as const,
        sourceId: a.uuid,
        climbCount: a.totalClimbs,
        // pathTokens runs country > state > ... > this crag; the parent is most useful.
        region: a.pathTokens.length > 1 ? a.pathTokens[a.pathTokens.length - 2] : undefined,
      }));
  });
}

// --- Combined ------------------------------------------------------------------
export type NearbyResult = {
  areas: NearbyArea[];
  /** Per-source failures, so one service being down doesn't hide the other. */
  errors: { gyms?: string; crags?: string };
};

export async function fetchNearby(center: LatLng, radiusKm: number): Promise<NearbyResult> {
  const [gyms, crags] = await Promise.allSettled([fetchGyms(center, radiusKm), fetchCrags(center, radiusKm)]);
  const errors: NearbyResult['errors'] = {};
  const all: ClimbingArea[] = [];
  if (gyms.status === 'fulfilled') all.push(...gyms.value);
  else errors.gyms = String((gyms.reason as Error)?.message ?? gyms.reason);
  if (crags.status === 'fulfilled') all.push(...crags.value);
  else errors.crags = String((crags.reason as Error)?.message ?? crags.reason);

  const areas = all
    .map((a) => ({ ...a, distanceKm: distanceKm(center, a.location) }))
    .filter((a) => a.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return { areas, errors };
}

/** Link that opens directions in the platform's maps app. */
export function directionsUrl(area: ClimbingArea): string {
  const { latitude, longitude } = area.location;
  const q = encodeURIComponent(area.name);
  if (Platform.OS === 'ios') return `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/** Link to the source page with more detail. */
export function sourceUrl(area: ClimbingArea): string | undefined {
  if (area.source === 'openbeta' && area.sourceId) return `https://openbeta.io/area/${area.sourceId}`;
  if (area.source === 'osm' && area.sourceId) return `https://www.openstreetmap.org/${area.sourceId}`;
  return undefined;
}

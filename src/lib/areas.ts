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
  for (const area of data) known.set(area.id, area);
  return data;
}

/** Every area seen this session, by id, so a detail screen opens instantly. */
const known = new Map<string, ClimbingArea>();

export function knownArea(id: string): ClimbingArea | undefined {
  return known.get(id);
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
  const parts = [street, t['addr:city'], t['addr:state']].filter(Boolean);
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

/** fetch() that gives up after `ms` (free services can hang instead of failing). */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number, outer?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  outer?.addEventListener('abort', abort);
  const timer = setTimeout(abort, ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !outer?.aborted) throw new Error('timed out');
    throw e;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', abort);
  }
}

/** Asks every Overpass mirror at once and uses whichever answers first. */
async function queryOverpass(query: string): Promise<OsmElement[]> {
  const race = new AbortController();
  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
    const res = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA },
        body: `data=${encodeURIComponent(query)}`,
      },
      12_000,
      race.signal,
    );
    if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
    return ((await res.json()) as { elements: OsmElement[] }).elements;
  });
  try {
    return await Promise.any(attempts);
  } catch (e) {
    const errors = (e as AggregateError).errors ?? [e];
    throw errors[0] instanceof Error ? errors[0] : new Error(String(errors[0]));
  } finally {
    race.abort(); // stop the slower mirror
  }
}

function osmToGym(el: OsmElement): ClimbingArea | null {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  return {
    id: `osm:${el.type}/${el.id}`,
    kind: 'gym',
    name: t.name,
    location: { latitude: lat, longitude: lon },
    address: osmAddress(t),
    styles: osmStyles(t),
    source: 'osm',
    sourceId: `${el.type}/${el.id}`,
    website: t.website ?? t['contact:website'],
    phone: t.phone ?? t['contact:phone'],
    openingHours: t.opening_hours,
  };
}

export function fetchGyms(center: LatLng, radiusKm: number): Promise<ClimbingArea[]> {
  return cached(cacheKey('gyms', center, radiusKm), async () => {
    const r = Math.round(radiusKm * 1000);
    const at = `(around:${r},${center.latitude},${center.longitude})`;
    // Indoor climbing: sport=climbing on a gym-like place. Outdoor crags are
    // also tagged sport=climbing in OSM, so require an indoor-ish tag.
    const query = `[out:json][timeout:12];(
      nwr["sport"~"climbing|bouldering"]["leisure"~"^(sports_centre|fitness_centre|sports_hall)$"]${at};
      nwr["sport"~"climbing|bouldering"]["indoor"="yes"]${at};
      nwr["sport"~"climbing|bouldering"]["building"]${at};
    );out center tags 200;`;
    const elements = await queryOverpass(query);
    const seen = new Set<string>();
    const gyms: ClimbingArea[] = [];
    for (const el of elements) {
      const gym = osmToGym(el);
      if (!gym || seen.has(gym.id)) continue;
      seen.add(gym.id);
      gyms.push(gym);
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

function openBetaToCrag(a: OpenBetaArea): ClimbingArea | null {
  if (a.metadata.lat == null || a.metadata.lng == null) return null;
  return {
    id: `openbeta:${a.uuid}`,
    kind: 'crag',
    name: a.areaName,
    location: { latitude: a.metadata.lat, longitude: a.metadata.lng },
    styles: a.metadata.isBoulder ? ['bouldering'] : [],
    source: 'openbeta',
    sourceId: a.uuid,
    climbCount: a.totalClimbs,
    // pathTokens runs country > state > ... > this crag; the parent is most useful.
    region: a.pathTokens.length > 1 ? a.pathTokens[a.pathTokens.length - 2] : undefined,
    path: a.pathTokens.slice(0, -1),
  };
}

export function fetchCrags(center: LatLng, radiusKm: number): Promise<ClimbingArea[]> {
  return cached(cacheKey('crags', center, radiusKm), async () => {
    const query = `query Crags($bbox: [Float]) {
      cragsWithin(filter: { bbox: $bbox, zoom: 14 }) {
        uuid areaName totalClimbs pathTokens
        metadata { lat lng isBoulder }
      }
    }`;
    const res = await fetchWithTimeout(
      OPENBETA,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...UA },
        body: JSON.stringify({ query, variables: { bbox: bboxAround(center, radiusKm) } }),
      },
      8_000,
    );
    if (!res.ok) throw new Error(`OpenBeta returned ${res.status}`);
    const json = (await res.json()) as { data?: { cragsWithin: OpenBetaArea[] }; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return (json.data?.cragsWithin ?? [])
      .filter((a) => a.totalClimbs > 0)
      .map(openBetaToCrag)
      .filter((a): a is ClimbingArea => a !== null);
  });
}

// --- Combined ------------------------------------------------------------------
export type NearbyState = {
  /** Everything loaded so far, nearest first. */
  areas: NearbyArea[];
  /** Which sources are still loading. */
  pending: { gyms: boolean; crags: boolean };
  /** Per-source failures, so one service being down doesn't hide the other. */
  errors: { gyms?: string; crags?: string };
};

/**
 * Loads gyms and crags in parallel and reports after each one arrives, so the
 * list shows gyms as soon as they're in instead of waiting for the slower
 * source. Returns a cancel function.
 */
export function loadNearby(center: LatLng, radiusKm: number, onUpdate: (state: NearbyState) => void): () => void {
  let cancelled = false;
  const found: ClimbingArea[] = [];
  const state: NearbyState = { areas: [], pending: { gyms: true, crags: true }, errors: {} };

  const publish = () => {
    if (cancelled) return;
    state.areas = found
      .map((a) => ({ ...a, distanceKm: distanceKm(center, a.location) }))
      .filter((a) => a.distanceKm <= radiusKm)
      .sort((x, y) => x.distanceKm - y.distanceKm);
    onUpdate({ ...state, pending: { ...state.pending }, errors: { ...state.errors } });
  };

  const run = (kind: 'gyms' | 'crags', load: Promise<ClimbingArea[]>) =>
    load
      .then((areas) => found.push(...areas))
      .catch((e: unknown) => {
        state.errors[kind] = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        state.pending[kind] = false;
        publish();
      });

  run('gyms', fetchGyms(center, radiusKm));
  run('crags', fetchCrags(center, radiusKm));
  return () => {
    cancelled = true;
  };
}

/** Link that opens directions in the platform's maps app. */
export function directionsUrl(area: ClimbingArea): string {
  const { latitude, longitude } = area.location;
  const q = encodeURIComponent(area.name);
  if (Platform.OS === 'ios') return `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

// --- Single area (detail screen) ----------------------------------------------

/** URL-safe form of an area id: "osm:way/123" <-> "osm-way-123". */
export function areaSlug(id: string): string {
  return id.replace(':', '-').replace('/', '-');
}

function slugToId(slug: string): string | null {
  const osm = /^osm-(node|way|relation)-(\d+)$/.exec(slug);
  if (osm) return `osm:${osm[1]}/${osm[2]}`;
  const ob = /^openbeta-([0-9a-f-]{8,})$/i.exec(slug);
  if (ob) return `openbeta:${ob[1]}`;
  return null;
}

/** Loads one gym or crag; uses what's already been fetched when possible. */
export async function fetchAreaBySlug(slug: string): Promise<ClimbingArea | null> {
  const id = slugToId(slug);
  if (!id) return null;
  const hit = known.get(id);
  if (hit) return hit;

  if (id.startsWith('osm:')) {
    const [type, num] = id.slice(4).split('/');
    const elements = await queryOverpass(`[out:json][timeout:15];${type}(${num});out center tags;`);
    const gym = elements.length ? osmToGym(elements[0]) : null;
    if (gym) known.set(gym.id, gym);
    return gym;
  }

  const uuid = id.slice('openbeta:'.length);
  const query = `query Area($uuid: ID) {
    area(uuid: $uuid) { uuid areaName totalClimbs pathTokens metadata { lat lng isBoulder } }
  }`;
  const res = await fetch(OPENBETA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...UA },
    body: JSON.stringify({ query, variables: { uuid } }),
  });
  if (!res.ok) throw new Error(`OpenBeta returned ${res.status}`);
  const json = (await res.json()) as { data?: { area: OpenBetaArea | null } };
  const crag = json.data?.area ? openBetaToCrag(json.data.area) : null;
  if (crag) known.set(crag.id, crag);
  return crag;
}

/** Link to the source page with more detail. */
export function sourceUrl(area: ClimbingArea): string | undefined {
  if (area.source === 'openbeta' && area.sourceId) return `https://openbeta.io/area/${area.sourceId}`;
  if (area.source === 'osm' && area.sourceId) return `https://www.openstreetmap.org/${area.sourceId}`;
  return undefined;
}

/** Where someone can correct or add missing details. */
export function editUrl(area: ClimbingArea): string | undefined {
  if (area.source === 'osm' && area.sourceId) {
    const [type, num] = area.sourceId.split('/');
    return `https://www.openstreetmap.org/edit?${type}=${num}`;
  }
  if (area.source === 'openbeta' && area.sourceId) return `https://openbeta.io/area/${area.sourceId}`;
  return undefined;
}

export function phoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

// "Gyms near here" from our own catalog (public.gyms), refreshed from
// OpenStreetMap (Overpass) when an area is new or over a week old. If Overpass
// is down, whatever is already saved is returned (stale: true).
//
// POST { lat, lng, radiusKm } -> { gyms: ClimbingArea[], stale: boolean }
// Public: no secret needed. Rows are public map data; the function only ever
// asks Overpass for a coarse, cached area, never the person's exact position.
// Data © OpenStreetMap contributors (ODbL).

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ENDPOINTS = (
  Deno.env.get('OVERPASS_URLS') ??
    'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter'
).split(',');
const FRESH_MS = 7 * 24 * 3600_000;
const BUCKETS = [10, 25, 50, 100];
const MAX_ELEMENTS = 500;
// The cell center is snapped to 0.1 degrees (up to ~7 km off), so fetch that much extra.
const SNAP_MARGIN_KM = 8;

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type GymRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  styles: string[];
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  source: string;
  source_id: string | null;
};

function address(t: Record<string, string>): string | null {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const parts = [street, t['addr:city'], t['addr:state']].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function styles(t: Record<string, string>): string[] {
  const sport = t.sport ?? '';
  const out = new Set<string>();
  if (/bouldering/.test(sport) || t['climbing:boulder'] === 'yes') out.add('bouldering');
  if (t['climbing:toprope'] === 'yes') out.add('top-rope');
  if (t['climbing:sport'] === 'yes') out.add('lead');
  return [...out];
}

function toRow(el: OsmElement): GymRow | null {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  return {
    id: `osm:${el.type}/${el.id}`,
    name: t.name,
    latitude: lat,
    longitude: lon,
    address: address(t),
    styles: styles(t),
    website: t.website ?? t['contact:website'] ?? null,
    phone: t.phone ?? t['contact:phone'] ?? null,
    opening_hours: t.opening_hours ?? null,
    source: 'osm',
    source_id: `${el.type}/${el.id}`,
  };
}

/** Asks every Overpass mirror at once and uses whichever answers first. */
async function overpass(query: string): Promise<OsmElement[]> {
  const race = new AbortController();
  const attempts = ENDPOINTS.map(async (endpoint) => {
    const timer = setTimeout(() => race.abort(), 25_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'BelayBuddy/0.1 (https://belaybuddy.app; support@belaybuddy.app)',
          Referer: 'https://belaybuddy.app/',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: race.signal,
      });
      if (!res.ok) throw new Error(`${new URL(endpoint).hostname} returned ${res.status}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } finally {
      clearTimeout(timer);
    }
  });
  try {
    return await Promise.any(attempts);
  } catch (e) {
    // Say what every mirror answered, so a block or outage is easy to spot.
    const all = ((e as AggregateError).errors ?? [e]).map((x: unknown) => (x instanceof Error ? x.message : String(x)));
    throw new Error(all.join('; '));
  } finally {
    race.abort();
  }
}

const makeDb = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
type Db = ReturnType<typeof makeDb>;

/** Fetches one cell ("lat,lng:bucket") from Overpass and saves it. Returns how many gyms it found. */
async function refreshCell(db: Db, cell: string): Promise<number> {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?):(\d+)$/.exec(cell);
  if (!m) throw new Error(`bad cell ${cell}`);
  const [snapLat, snapLng, bucket] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const started = new Date().toISOString();
  const radiusKm = bucket + SNAP_MARGIN_KM;
  // A bounding box is much cheaper for Overpass than an "around" circle.
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((snapLat * Math.PI) / 180), 0.01));
  const at = `(${(snapLat - dLat).toFixed(4)},${(snapLng - dLng).toFixed(4)},${(snapLat + dLat).toFixed(4)},${(snapLng + dLng).toFixed(4)})`;
  // Indoor climbing: sport=climbing on a gym-like place. Outdoor crags are
  // also tagged sport=climbing in OSM, so require an indoor-ish tag.
  const query = `[out:json][timeout:25];(
    nwr["sport"~"climbing|bouldering"]["leisure"~"^(sports_centre|fitness_centre|sports_hall)$"]${at};
    nwr["sport"~"climbing|bouldering"]["indoor"="yes"]${at};
    nwr["sport"~"climbing|bouldering"]["building"]${at};
  );out center tags ${MAX_ELEMENTS};`;
  const elements = await overpass(query);
  const rows = new Map<string, GymRow>();
  for (const el of elements) {
    const row = toRow(el);
    if (row) rows.set(row.id, row);
  }
  if (rows.size) {
    const { error } = await db.from('gyms').upsert([...rows.values()].map((r) => ({ ...r, fetched_at: started })));
    if (error) throw new Error(`saving gyms: ${error.message}`);
  }
  // Gyms in this circle that OpenStreetMap no longer returns are gone. Only
  // trust that when the answer wasn't cut off at the element limit.
  if (elements.length < MAX_ELEMENTS) {
    const { error } = await db.rpc('prune_gyms', { p_lat: snapLat, p_lng: snapLng, p_radius_km: radiusKm, p_before: started });
    if (error) console.warn('prune failed', error.message);
  }
  await db.from('gym_cells').upsert({ cell, fetched_at: new Date().toISOString() });
  return rows.size;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Scheduled refresh (from the database, hourly): protected by the shared secret.
  if (Array.isArray(body.refreshCells)) {
    const secret = Deno.env.get('NOTIFY_SECRET');
    if (!secret || req.headers.get('x-notify-secret') !== secret) return json({ error: 'Forbidden' }, 403);
    const admin = makeDb();
    const results: Record<string, string> = {};
    for (const cell of body.refreshCells.slice(0, 5).map(String)) {
      await admin.from('gym_cells').update({ last_try_at: new Date().toISOString() }).eq('cell', cell);
      try {
        results[cell] = `${await refreshCell(admin, cell)} gyms`;
      } catch (e) {
        results[cell] = `failed: ${(e as Error).message}`;
      }
      await sleep(Number(Deno.env.get('GYMS_PAUSE_MS') ?? 3000)); // be kind to Overpass
    }
    return json({ refreshed: results });
  }
  const lat = num(body.lat);
  const lng = num(body.lng);
  const radius = num(body.radiusKm);
  if (lat == null || lng == null || radius == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || radius <= 0) {
    return json({ error: 'Send lat, lng and radiusKm' }, 400);
  }
  const radiusKm = Math.min(radius, 100);

  const db = makeDb();

  const snapLat = Math.round(lat * 10) / 10;
  const snapLng = Math.round(lng * 10) / 10;
  const bucket = BUCKETS.find((b) => b >= radiusKm) ?? 100;
  const cell = `${snapLat.toFixed(1)},${snapLng.toFixed(1)}:${bucket}`;

  const { data: seen } = await db.from('gym_cells').select('fetched_at').eq('cell', cell).maybeSingle();
  const fresh = seen && Date.now() - new Date(seen.fetched_at).getTime() < FRESH_MS;

  let stale = false;
  let problem = '';
  if (!fresh) {
    try {
      await refreshCell(db, cell);
    } catch (e) {
      stale = true;
      problem = (e as Error).message;
      console.warn('refresh failed', cell, problem);
    }
  }

  const { data, error } = await db.rpc('nearby_gyms', { p_lat: lat, p_lng: lng, p_radius_km: radiusKm });
  if (error) return json({ error: error.message }, 500);
  const gyms = ((data ?? []) as GymRow[]).map((g) => ({
    id: g.id,
    kind: 'gym',
    name: g.name,
    location: { latitude: g.latitude, longitude: g.longitude },
    address: g.address ?? undefined,
    styles: g.styles,
    source: g.source,
    sourceId: g.source_id ?? undefined,
    website: g.website ?? undefined,
    phone: g.phone ?? undefined,
    openingHours: g.opening_hours ?? undefined,
  }));
  // Nothing saved and Overpass failed: say so rather than claim "no gyms here".
  if (stale && gyms.length === 0) return json({ error: `Gym data is unavailable right now (${problem})` }, 502);
  return json({ gyms, stale });
});

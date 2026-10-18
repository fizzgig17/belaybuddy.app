// "Gyms near here" from our own catalog (public.gyms), which GitHub workflows fill
// from OpenStreetMap (Overpass blocks Supabase's servers) and Overture Maps.
//
// POST { lat, lng, radiusKm } -> { gyms: ClimbingArea[], covered: boolean, regionLoaded: boolean }
// covered=false means this area isn't fully saved yet (it is queued for the nightly job).
// regionLoaded=true means a bulk source (Overture Maps) has loaded this region.
// Public: no secret needed. Rows are public map data; the function only ever
// asks Overpass for a coarse, cached area, never the person's exact position.
// Data © OpenStreetMap contributors (ODbL) and © Overture Maps Foundation (CDLA-Permissive-2.0).

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
const BUCKETS = [10, 25, 50];
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

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

function km(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Drops Overture gyms that are the same place as an OpenStreetMap one (close by, names match). */
function withoutDuplicates(rows: GymRow[]): GymRow[] {
  const osm = rows.filter((r) => r.source === 'osm').map((r) => ({ r, n: norm(r.name) }));
  return rows.filter((g) => {
    if (g.source !== 'overture') return true;
    const n = norm(g.name);
    return !osm.some((o) => o.n.length >= 4 && n.length >= 4 && (o.n.includes(n) || n.includes(o.n)) && km(o.r, g) < 0.3);
  });
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
${['climbing', 'bouldering']
  .flatMap((sport) => [
    `nwr["sport"="${sport}"]["leisure"~"^(sports_centre|fitness_centre|sports_hall)$"]${at};`,
    `nwr["sport"="${sport}"]["indoor"="yes"]${at};`,
    `nwr["sport"="${sport}"]["building"]${at};`,
  ])
  .join('\n')}
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
  const bucket = BUCKETS.find((b) => b >= radiusKm) ?? 50;
  const cell = `${snapLat.toFixed(1)},${snapLng.toFixed(1)}:${bucket}`;

  const { data: seen } = await db.from('gym_cells').select('fetched_at').eq('cell', cell).maybeSingle();
  const fresh = seen && Date.now() - new Date(seen.fetched_at).getTime() < FRESH_MS;

  // Never ask Overpass from here: it blocks Supabase's servers, so the call only
  // made people wait. Answer from what is saved and note whether this area is
  // covered. If not, remember the request so the nightly job (see
  // .github/workflows/seed-requested.yml) saves it, and the app looks it up
  // directly from the phone in the meantime.
  // A bulk source (Overture Maps) may have loaded this whole region already.
  const { data: region } = await db
    .from('gym_coverage')
    .select('id')
    .lte('min_lat', lat)
    .gte('max_lat', lat)
    .lte('min_lng', lng)
    .gte('max_lng', lng)
    .gte('loaded_at', new Date(Date.now() - 60 * 24 * 3600_000).toISOString())
    .limit(1);
  const covered = Boolean(fresh);
  // Overture covers this region, but it is not every gym, so it never counts as "covered" on its own.
  const regionLoaded = Boolean(region?.length);
  if (!fresh) {
    const { error: reqError } = await db.rpc('request_gym_area', { p_cell: cell });
    if (reqError) console.warn('request failed', reqError.message);
  }

  const { data, error } = await db.rpc('nearby_gyms', { p_lat: lat, p_lng: lng, p_radius_km: radiusKm });
  if (error) return json({ error: error.message }, 500);
  const gyms = withoutDuplicates((data ?? []) as GymRow[]).map((g) => ({
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
  return json({ gyms, covered, regionLoaded });
});

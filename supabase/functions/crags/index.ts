// "Crags near here" from our own catalog (public.crags), refreshed from
// OpenBeta (https://openbeta.io, public domain / CC0) when an area is new or
// over a week old. If OpenBeta is down, whatever is already saved is returned
// (stale: true).
//
// POST { lat, lng, radiusKm } -> { crags: ClimbingArea[], stale: boolean }
// Public: no secret needed. Rows are public map data; the function only ever
// asks OpenBeta for a coarse, cached area, never the person's exact position.

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const OPENBETA = Deno.env.get('OPENBETA_URL') ?? 'https://api.openbeta.io/';
const FRESH_MS = 7 * 24 * 3600_000;
const BUCKETS = [10, 25, 50, 100];
const MAX_CRAGS = 1000;
// The cell center is snapped to 0.1 degrees (up to ~7 km off), so fetch that much extra.
const SNAP_MARGIN_KM = 8;

type OpenBetaArea = {
  uuid: string;
  areaName: string;
  totalClimbs: number;
  pathTokens: string[];
  metadata: { lat: number | null; lng: number | null; isBoulder: boolean | null };
};

type CragRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_boulder: boolean;
  climb_count: number;
  region: string | null;
  path: string[];
  source_id: string | null;
};

function toRow(a: OpenBetaArea): CragRow | null {
  if (a.metadata?.lat == null || a.metadata?.lng == null || !a.areaName || !(a.totalClimbs > 0)) return null;
  const tokens = a.pathTokens ?? [];
  return {
    id: `openbeta:${a.uuid}`,
    name: a.areaName,
    latitude: a.metadata.lat,
    longitude: a.metadata.lng,
    is_boulder: !!a.metadata.isBoulder,
    climb_count: a.totalClimbs,
    // pathTokens runs country > state > ... > this crag; the parent is most useful.
    region: tokens.length > 1 ? tokens[tokens.length - 2] : null,
    path: tokens.slice(0, -1),
    source_id: a.uuid,
  };
}

async function openBeta(bbox: number[]): Promise<OpenBetaArea[]> {
  const query = `query Crags($bbox: [Float]) {
    cragsWithin(filter: { bbox: $bbox, zoom: 14 }) {
      uuid areaName totalClimbs pathTokens
      metadata { lat lng isBoulder }
    }
  }`;
  const res = await fetch(OPENBETA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'BelayBuddy/0.1 (https://belaybuddy.app; support@belaybuddy.app)' },
    body: JSON.stringify({ query, variables: { bbox } }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`OpenBeta returned ${res.status}`);
  const out = (await res.json()) as { data?: { cragsWithin: OpenBetaArea[] }; errors?: { message: string }[] };
  if (out.errors?.length) throw new Error(out.errors[0].message);
  return out.data?.cragsWithin ?? [];
}

const makeDb = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
type Db = ReturnType<typeof makeDb>;

/** Fetches one cell ("lat,lng:bucket") from OpenBeta and saves it. Returns how many crags it found. */
async function refreshCell(db: Db, snapLat: number, snapLng: number, bucket: number, cell: string): Promise<number> {
  const started = new Date().toISOString();
  const radiusKm = bucket + SNAP_MARGIN_KM;
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((snapLat * Math.PI) / 180), 0.01));
  // OpenBeta's bbox order is [minLng, minLat, maxLng, maxLat].
  const [west, south, east, north] = [snapLng - dLng, snapLat - dLat, snapLng + dLng, snapLat + dLat];
  const areas = await openBeta([west, south, east, north]);
  const rows = new Map<string, CragRow>();
  for (const a of areas) {
    const row = toRow(a);
    if (row) rows.set(row.id, row);
  }
  if (rows.size) {
    const { error } = await db.from('crags').upsert([...rows.values()].map((r) => ({ ...r, fetched_at: started })));
    if (error) throw new Error(`saving crags: ${error.message}`);
  }
  // Crags in this box that OpenBeta no longer returns are gone. Only trust
  // that when the answer wasn't cut off at a large size.
  if (areas.length < MAX_CRAGS) {
    const { error } = await db.rpc('prune_crags', { p_south: south, p_west: west, p_north: north, p_east: east, p_before: started });
    if (error) console.warn('prune failed', error.message);
  }
  await db.from('crag_cells').upsert({ cell, fetched_at: new Date().toISOString() });
  return rows.size;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
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

  const { data: seen } = await db.from('crag_cells').select('fetched_at').eq('cell', cell).maybeSingle();
  const fresh = seen && Date.now() - new Date(seen.fetched_at).getTime() < FRESH_MS;

  let stale = false;
  let problem = '';
  if (!fresh) {
    try {
      await refreshCell(db, snapLat, snapLng, bucket, cell);
    } catch (e) {
      stale = true;
      problem = (e as Error).message;
      console.warn('refresh failed', cell, problem);
    }
  }

  const { data, error } = await db.rpc('nearby_crags', { p_lat: lat, p_lng: lng, p_radius_km: radiusKm });
  if (error) return json({ error: error.message }, 500);
  const crags = ((data ?? []) as CragRow[]).map((c) => ({
    id: c.id,
    kind: 'crag',
    name: c.name,
    location: { latitude: c.latitude, longitude: c.longitude },
    styles: c.is_boulder ? ['bouldering'] : [],
    source: 'openbeta',
    sourceId: c.source_id ?? undefined,
    climbCount: c.climb_count,
    region: c.region ?? undefined,
    path: c.path,
  }));
  // Nothing saved and OpenBeta failed: say so rather than claim "no crags here".
  if (stale && crags.length === 0) return json({ error: `Crag data is unavailable right now (${problem})` }, 502);
  return json({ crags, stale });
});

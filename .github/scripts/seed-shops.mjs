// Fills the shop catalog (public.shops) around popular climbing areas from
// OpenStreetMap, then writes SQL for psql to apply. Same approach as
// seed-gyms.mjs: run on a CI runner, one request at a time with pauses.
//
//   node seed-shops.mjs <out.sql>
import { writeFileSync } from 'node:fs';

import { PLACES } from './places.mjs';

const RADIUS_KM = 45;
const MAX_ELEMENTS = 800;
const PAUSE_MS = Number(process.env.SEED_PAUSE_MS ?? 6000);
const ENDPOINTS = process.env.OVERPASS_URLS?.split(',') ?? [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const CLIMBING_NAME = /climb|boulder|mountain|alpine|vertical|summit|outfitter/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
  const problems = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'BelayBuddy-seed/0.1 (https://belaybuddy.app; support@belaybuddy.app)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()).elements;
    } catch (e) {
      problems.push(`${new URL(endpoint).hostname}: ${e.message}`);
    }
  }
  throw new Error(problems.join('; '));
}

const address = (t) => {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const parts = [street, t['addr:city'], t['addr:state']].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};
function toRow(el) {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  return {
    id: `osm:${el.type}/${el.id}`, name: t.name, latitude: lat, longitude: lon, address: address(t),
    website: t.website ?? t['contact:website'] ?? null, phone: t.phone ?? t['contact:phone'] ?? null,
    opening_hours: t.opening_hours ?? null,
    climbing: /climbing|bouldering/.test(t.sport ?? '') || t.shop === 'climbing' || CLIMBING_NAME.test(t.name),
    source: 'osm', source_id: `${el.type}/${el.id}`,
  };
}

const outPath = process.argv[2];
const terms = (process.env.SEED_FILTER ?? '').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
const chosen = terms.length ? PLACES.filter(([name]) => terms.some((t) => name.toLowerCase().includes(t))) : PLACES;
const only = process.env.SEED_ONLY ? Number(process.env.SEED_ONLY) : chosen.length;
const sql = [];
const seen = new Map();
let ok = 0;
const failed = [];

for (const [name, lat0, lng0] of chosen.slice(0, only)) {
  const dLat = RADIUS_KM / 111.32;
  const dLng = RADIUS_KM / (111.32 * Math.max(Math.cos((lat0 * Math.PI) / 180), 0.01));
  const at = `(${(lat0 - dLat).toFixed(4)},${(lng0 - dLng).toFixed(4)},${(lat0 + dLat).toFixed(4)},${(lng0 + dLng).toFixed(4)})`;
  // Exact tag values (no regex scans) keep this cheap for Overpass.
  const query = `[out:json][timeout:50];(
nwr["shop"="outdoor"]${at};
nwr["shop"="climbing"]${at};
nwr["shop"="sports"]["sport"="climbing"]${at};
nwr["shop"="sports"]["sport"="bouldering"]${at};
);out center tags ${MAX_ELEMENTS};`;
  try {
    const started = new Date().toISOString();
    const elements = await overpass(query);
    const rows = elements.map(toRow).filter(Boolean);
    for (const r of rows) seen.set(r.id, r);
    const json = JSON.stringify(rows).replaceAll('$json$', '');
    sql.push(
      `-- ${name}: ${rows.length} shops`,
      rows.length
        ? `insert into public.shops (id, name, latitude, longitude, address, website, phone, opening_hours, climbing, source, source_id)
           select id, name, latitude, longitude, address, website, phone, opening_hours, coalesce(climbing, false), source, source_id
           from json_populate_recordset(null::public.shops, $json$${json}$json$)
           on conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
             address = excluded.address, website = excluded.website, phone = excluded.phone,
             opening_hours = excluded.opening_hours, climbing = excluded.climbing, source = excluded.source,
             source_id = excluded.source_id, fetched_at = now();`
        : '',
      elements.length < MAX_ELEMENTS ? `select public.prune_shops(${lat0}, ${lng0}, ${RADIUS_KM}, '${started}');` : '',
    );
    ok++;
    console.log(`${name}: ${rows.length} shops`);
  } catch (e) {
    failed.push(`${name}: ${e.message}`);
    console.log(`${name}: FAILED ${e.message}`);
  }
  await sleep(PAUSE_MS);
}

writeFileSync(outPath, sql.join('\n') + '\n');
console.log(`SUMMARY ${ok} areas ok, ${failed.length} failed, ${seen.size} shops`);
if (failed.length) console.log(`FAILED_LIST ${failed.slice(0, 5).join(' | ')}`);
process.exit(ok === 0 ? 1 : 0);

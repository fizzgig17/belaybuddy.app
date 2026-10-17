// Fills the gym catalog (public.gyms) for popular climbing areas from
// OpenStreetMap, then writes SQL for psql to apply. Run from GitHub Actions
// (see .github/workflows/seed-gyms.yml): Overpass blocks many cloud IPs, but
// a CI runner works, one request at a time and with pauses between them.
//
//   node seed-gyms.mjs <out.sql>
//
// Cells use the same keys as the gyms Edge Function ("lat,lng:bucket", center
// rounded to 0.1 degrees), so an app search near one is served from the catalog.
import { writeFileSync } from 'node:fs';

import { PLACES } from './places.mjs';

const BUCKET = 25;
const SNAP_MARGIN_KM = 8;
const MAX_ELEMENTS = 500;
const PAUSE_MS = Number(process.env.SEED_PAUSE_MS ?? 6000);
const ENDPOINTS = process.env.OVERPASS_URLS?.split(',') ?? [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];


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
const styles = (t) => {
  const out = new Set();
  if (/bouldering/.test(t.sport ?? '') || t['climbing:boulder'] === 'yes') out.add('bouldering');
  if (t['climbing:toprope'] === 'yes') out.add('top-rope');
  if (t['climbing:sport'] === 'yes') out.add('lead');
  return [...out];
};
function toRow(el) {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  return {
    id: `osm:${el.type}/${el.id}`, name: t.name, latitude: lat, longitude: lon, address: address(t), styles: styles(t),
    website: t.website ?? t['contact:website'] ?? null, phone: t.phone ?? t['contact:phone'] ?? null,
    opening_hours: t.opening_hours ?? null, source: 'osm', source_id: `${el.type}/${el.id}`,
  };
}

const outPath = process.argv[2];
// SEED_FILTER="boone,asheville" seeds only areas whose name contains one of those.
const terms = (process.env.SEED_FILTER ?? '').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
const chosen = terms.length ? PLACES.filter(([name]) => terms.some((t) => name.toLowerCase().includes(t))) : PLACES;
const only = process.env.SEED_ONLY ? Number(process.env.SEED_ONLY) : chosen.length;
const sql = [];
const seen = new Map();
let ok = 0;
const failed = [];

for (const [name, lat0, lng0] of chosen.slice(0, only)) {
  const lat = Math.round(lat0 * 10) / 10;
  const lng = Math.round(lng0 * 10) / 10;
  const cell = `${lat.toFixed(1)},${lng.toFixed(1)}:${BUCKET}`;
  const radiusKm = BUCKET + SNAP_MARGIN_KM;
  // A bounding box is much cheaper for Overpass than an "around" circle.
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const at = `(${(lat - dLat).toFixed(4)},${(lng - dLng).toFixed(4)},${(lat + dLat).toFixed(4)},${(lng + dLng).toFixed(4)})`;
  const query = `[out:json][timeout:50];(
${['climbing', 'bouldering']
  .flatMap((sport) => [
    `nwr["sport"="${sport}"]["leisure"~"^(sports_centre|fitness_centre|sports_hall)$"]${at};`,
    `nwr["sport"="${sport}"]["indoor"="yes"]${at};`,
    `nwr["sport"="${sport}"]["building"]${at};`,
  ])
  .join('\n')}
  );out center tags ${MAX_ELEMENTS};`;
  try {
    const started = new Date().toISOString();
    const elements = await overpass(query);
    const rows = elements.map(toRow).filter(Boolean);
    for (const r of rows) seen.set(r.id, r);
    const json = JSON.stringify(rows).replaceAll('$json$', '');
    sql.push(
      `-- ${name}: ${rows.length} gyms`,
      rows.length
        ? `insert into public.gyms (id, name, latitude, longitude, address, styles, website, phone, opening_hours, source, source_id)
           select id, name, latitude, longitude, address, coalesce(styles, '{}'), website, phone, opening_hours, source, source_id
           from json_populate_recordset(null::public.gyms, $json$${json}$json$)
           on conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
             address = excluded.address, styles = excluded.styles, website = excluded.website, phone = excluded.phone,
             opening_hours = excluded.opening_hours, source = excluded.source, source_id = excluded.source_id, fetched_at = now();`
        : '',
      elements.length < MAX_ELEMENTS ? `select public.prune_gyms(${lat}, ${lng}, ${radiusKm}, '${started}');` : '',
      `insert into public.gym_cells (cell, fetched_at) values ('${cell}', now()) on conflict (cell) do update set fetched_at = now();`,
    );
    ok++;
    console.log(`${name}: ${rows.length} gyms`);
  } catch (e) {
    failed.push(`${name}: ${e.message}`);
    console.log(`${name}: FAILED ${e.message}`);
  }
  await sleep(PAUSE_MS);
}

writeFileSync(outPath, sql.join('\n') + '\n');
console.log(`SUMMARY ${ok} areas ok, ${failed.length} failed, ${seen.size} gyms`);
if (failed.length) console.log(`FAILED_LIST ${failed.slice(0, 5).join(' | ')}`);
process.exit(ok === 0 ? 1 : 0);

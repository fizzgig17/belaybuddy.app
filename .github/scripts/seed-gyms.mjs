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

// Popular climbing metros [name, lat, lng].
const PLACES = [
  ['Boulder, CO', 40.01, -105.27], ['Denver, CO', 39.74, -104.99], ['Fort Collins, CO', 40.59, -105.08],
  ['Colorado Springs, CO', 38.83, -104.82], ['Salt Lake City, UT', 40.76, -111.89], ['Seattle, WA', 47.61, -122.33],
  ['Portland, OR', 45.52, -122.68], ['Bend, OR', 44.06, -121.31], ['Oakland / SF, CA', 37.8, -122.27],
  ['San Jose, CA', 37.34, -121.89], ['Sacramento, CA', 38.58, -121.49], ['Los Angeles, CA', 34.05, -118.24],
  ['San Diego, CA', 32.72, -117.16], ['Phoenix, AZ', 33.45, -112.07], ['Tucson, AZ', 32.22, -110.97],
  ['Las Vegas, NV', 36.17, -115.14], ['Reno, NV', 39.53, -119.81], ['Albuquerque, NM', 35.08, -106.65],
  ['Boise, ID', 43.62, -116.2], ['Bozeman, MT', 45.68, -111.04], ['Anchorage, AK', 61.22, -149.9],
  ['Honolulu, HI', 21.31, -157.86], ['Austin, TX', 30.27, -97.74], ['Dallas, TX', 32.78, -96.8],
  ['Houston, TX', 29.76, -95.37], ['Kansas City, MO', 39.1, -94.58], ['St. Louis, MO', 38.63, -90.2],
  ['Minneapolis, MN', 44.98, -93.27], ['Madison, WI', 43.07, -89.4], ['Milwaukee, WI', 43.04, -87.91],
  ['Chicago, IL', 41.88, -87.63], ['Indianapolis, IN', 39.77, -86.16], ['Detroit, MI', 42.33, -83.05],
  ['Cleveland, OH', 41.5, -81.69], ['Columbus, OH', 39.96, -83.0], ['Cincinnati, OH', 39.1, -84.51],
  ['Louisville, KY', 38.25, -85.76], ['Nashville, TN', 36.16, -86.78], ['Chattanooga, TN', 35.05, -85.31],
  ['Atlanta, GA', 33.75, -84.39], ['Asheville, NC', 35.6, -82.55], ['Charlotte, NC', 35.23, -80.84],
  ['Raleigh, NC', 35.78, -78.64], ['Boone, NC', 36.22, -81.67], ['Durham / Chapel Hill, NC', 35.99, -78.9], ['Richmond, VA', 37.54, -77.44],
  ['Washington, DC', 38.91, -77.04], ['Baltimore, MD', 39.29, -76.61], ['Philadelphia, PA', 39.95, -75.17],
  ['Pittsburgh, PA', 40.44, -79.99], ['New York, NY', 40.71, -74.01], ['Boston, MA', 42.36, -71.06],
  ['Burlington, VT', 44.48, -73.21], ['Portland, ME', 43.66, -70.26], ['Miami, FL', 25.76, -80.19],
  ['Orlando, FL', 28.54, -81.38], ['Tampa, FL', 27.95, -82.46],
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

#!/usr/bin/env python3
"""Loads climbing gyms for the US and Canada from Overture Maps (open data, no key,
no live service) and writes SQL for psql to apply.

    python3 overture-gyms.py <out.sql>

Reads the latest Overture release straight from its public S3 bucket with DuckDB.
Data (c) Overture Maps Foundation, CDLA Permissive 2.0.
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter

import duckdb

BUCKET = 'overturemaps-us-west-2'
# Categories that mean an indoor climbing gym. Everything else that mentions climbing
# is logged (so the list can be tuned) but not loaded.
GYM = re.compile(r'^(rock_climbing_gym|climbing_gym|bouldering_gym|indoor_climbing\w*|climbing_wall\w*)$')
COUNTRIES = {'US', 'CA'}
MIN_ROWS = 100  # fewer than this means something is wrong; don't replace the data
COVERAGE = [  # id, min_lat, max_lat, min_lng, max_lng
    ('overture-us', 24.3, 49.6, -125.1, -66.8),
    ('overture-us-ak', 51.0, 71.6, -170.0, -129.9),
    ('overture-us-hi', 18.8, 22.4, -160.4, -154.7),
    ('overture-ca', 41.6, 60.0, -141.1, -52.5),
]


def latest_release() -> str:
    if os.environ.get('OVERTURE_RELEASE'):
        return os.environ['OVERTURE_RELEASE']
    url = f'https://{BUCKET}.s3.amazonaws.com/?prefix=release/&delimiter=/'
    with urllib.request.urlopen(url, timeout=60) as r:
        root = ET.fromstring(r.read())
    ns = {'s': 'http://s3.amazonaws.com/doc/2006-03-01/'}
    names = [e.text.strip('/').split('/')[-1] for e in root.findall('.//s:CommonPrefixes/s:Prefix', ns)]
    names = [n for n in names if re.match(r'^\d{4}-\d{2}-\d{2}', n)]
    if not names:
        raise SystemExit('Could not find an Overture release')
    return max(names)


def main(out_path: str) -> None:
    release = latest_release()
    path = f's3://{BUCKET}/release/{release}/theme=places/type=place/*'
    print(f'Overture release {release}')
    con = duckdb.connect()
    con.execute('INSTALL httpfs; LOAD httpfs;')
    con.execute("SET s3_region='us-west-2';")
    cols = {r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path}', hive_partitioning=1)").fetchall()}
    print('Columns:', ', '.join(sorted(cols)))
    status = "AND coalesce(operating_status, 'open') <> 'closed' AND coalesce(operating_status, 'open') <> 'permanently_closed'" if 'operating_status' in cols else ''
    sql = f"""
      SELECT id, names.primary AS name, categories.primary AS category, categories.alternate AS alt,
             addresses[1].freeform AS street, addresses[1].locality AS city, addresses[1].region AS region,
             addresses[1].country AS country, websites[1] AS website, phones[1] AS phone,
             (bbox.xmin + bbox.xmax) / 2 AS lng, (bbox.ymin + bbox.ymax) / 2 AS lat, confidence
      FROM read_parquet('{path}', hive_partitioning=1)
      WHERE bbox.xmin BETWEEN -180 AND -50 AND bbox.ymin BETWEEN 14 AND 72
        AND (categories.primary ILIKE '%climb%' OR categories.primary ILIKE '%boulder%'
             OR len(list_filter(coalesce(categories.alternate, []::VARCHAR[]), x -> x ILIKE '%climb%' OR x ILIKE '%boulder%')) > 0)
        {status}
    """
    result = con.execute(sql)
    names = [d[0] for d in result.description]
    found = [dict(zip(names, row)) for row in result.fetchall()]
    print(f'{len(found)} places mention climbing in North America')

    seen_categories = Counter()
    rows = {}
    for p in found:
        cats = [p['category'] or ''] + list(p['alt'] or [])
        seen_categories[p['category']] += 1
        if not any(GYM.match(c) for c in cats):
            continue
        if p['country'] and p['country'] not in COUNTRIES:
            continue
        if p['confidence'] is not None and p['confidence'] < 0.4:
            continue
        if not p['name'] or p['lat'] is None or p['lng'] is None:
            continue
        address = ', '.join(x for x in (p['street'], p['city'], p['region']) if x) or None
        rows[p['id']] = {
            'id': f"overture:{p['id']}", 'name': p['name'], 'latitude': p['lat'], 'longitude': p['lng'],
            'address': address, 'styles': ['bouldering'] if re.search(r'boulder', p['name'], re.I) else [],
            'website': p['website'], 'phone': p['phone'], 'opening_hours': None,
            'source': 'overture', 'source_id': p['id'],
        }
    print('Categories seen:', dict(seen_categories.most_common(15)))
    print(f'SUMMARY {len(rows)} gyms from release {release}')

    body = json.dumps(list(rows.values())).replace('$json$', '')
    out = ['begin;', "select set_config('bb.started', now()::text, true);"]
    if len(rows) >= MIN_ROWS:
        out.append(
            f"""insert into public.gyms (id, name, latitude, longitude, address, styles, website, phone, opening_hours, source, source_id)
select id, name, latitude, longitude, address, coalesce(styles, '{{}}'), website, phone, opening_hours, source, source_id
from json_populate_recordset(null::public.gyms, $json${body}$json$)
on conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
  address = excluded.address, styles = excluded.styles, website = excluded.website, phone = excluded.phone,
  opening_hours = excluded.opening_hours, source = excluded.source, source_id = excluded.source_id, fetched_at = now();"""
        )
        # Gyms Overture no longer lists are gone.
        out.append("delete from public.gyms where source = 'overture' and fetched_at < current_setting('bb.started')::timestamptz;")
        for cid, a, b, c, d in COVERAGE:
            out.append(
                f"insert into public.gym_coverage (id, source, min_lat, max_lat, min_lng, max_lng, loaded_at) values "
                f"('{cid}', 'overture', {a}, {b}, {c}, {d}, now()) on conflict (id) do update set loaded_at = now();"
            )
    else:
        out.append(f"-- only {len(rows)} gyms found; changed nothing")
    out.append('commit;')
    with open(out_path, 'w') as f:
        f.write('\n'.join(out) + '\n')
    if len(rows) < MIN_ROWS:
        print(f'::warning::Only {len(rows)} gyms found (expected hundreds); nothing will be changed')
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1])

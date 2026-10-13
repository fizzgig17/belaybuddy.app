-- Gyms now come from OpenStreetMap; allow 'osm' as a favorites source.
alter table public.favorites drop constraint favorites_source_check;
alter table public.favorites
  add constraint favorites_source_check
  check (source in ('osm', 'openbeta', 'mapkit', 'google-places', 'user'));

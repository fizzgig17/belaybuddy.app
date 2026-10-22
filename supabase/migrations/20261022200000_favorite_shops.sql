-- Shops can be saved as favorites too (shop ids look like osm:node/123, source 'osm').
alter table public.favorites drop constraint favorites_area_kind_check;
alter table public.favorites
  add constraint favorites_area_kind_check
  check (area_kind in ('gym', 'crag', 'shop'));

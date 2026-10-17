-- Climbing shops and outdoor stores near popular climbing areas, from OpenStreetMap.
-- Filled by the "Seed shops" workflow (a CI runner; Overpass blocks Supabase's servers).
-- The app reads it through nearby_shops() and falls back to asking OpenStreetMap live
-- for places that haven't been seeded.

create table public.shops (
  id text primary key,            -- like osm:node/123
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  website text,
  phone text,
  opening_hours text,
  climbing boolean not null default false,  -- tagged or named like a climbing shop
  source text not null default 'osm',
  source_id text,
  fetched_at timestamptz not null default now()
);

create index shops_location on public.shops (latitude, longitude);

alter table public.shops enable row level security;
create policy "Anyone can read shops" on public.shops for select to anon, authenticated using (true);
revoke all on table public.shops from anon, authenticated;
grant select on public.shops to anon, authenticated;
-- This project gives service_role no default table privileges.
grant select, insert, update, delete on public.shops to service_role;

create function public.nearby_shops(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit int default 300
)
returns setof public.shops
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.shops s
  where s.latitude between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and s.longitude between p_lng - p_radius_km / (111.32 * greatest(cos(radians(p_lat)), 0.01))
                        and p_lng + p_radius_km / (111.32 * greatest(cos(radians(p_lat)), 0.01))
    and 2 * 6371 * asin(sqrt(
          power(sin(radians(s.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - p_lng) / 2), 2)
        )) <= p_radius_km
  order by 2 * 6371 * asin(sqrt(
          power(sin(radians(s.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - p_lng) / 2), 2)
        ))
  limit least(p_limit, 500);
$$;

grant execute on function public.nearby_shops(double precision, double precision, double precision, int)
  to anon, authenticated, service_role;

-- Removes shops inside a circle that a re-seed that started at p_before didn't see
-- (they're gone from OpenStreetMap). Returns how many.
create function public.prune_shops(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_before timestamptz
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.shops s
  where s.source = 'osm'
    and s.fetched_at < p_before
    and s.latitude between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and 2 * 6371 * asin(sqrt(
          power(sin(radians(s.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - p_lng) / 2), 2)
        )) <= p_radius_km;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.prune_shops(double precision, double precision, double precision, timestamptz) from public, anon, authenticated;
grant execute on function public.prune_shops(double precision, double precision, double precision, timestamptz) to service_role;

notify pgrst, 'reload schema';

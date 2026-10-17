-- Our own catalog of climbing gyms, between the app and OpenStreetMap.
--
-- The `gyms` Edge Function answers "gyms near here" from this table, and
-- fills it from Overpass (OpenStreetMap, ODbL) when an area hasn't been
-- fetched in the last week, so the app doesn't wait on a shared public server
-- for every search. gym_cells remembers which areas were fetched and when.
-- Anyone can read gyms; only the function (service_role) writes.

create table public.gyms (
  id text primary key,                       -- "osm:way/123", same ids the app already uses
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text,
  styles text[] not null default '{}',
  website text,
  phone text,
  opening_hours text,
  source text not null default 'osm',
  source_id text,
  fetched_at timestamptz not null default now()
);

create index gyms_position on public.gyms (latitude, longitude);

create table public.gym_cells (
  cell text primary key,
  fetched_at timestamptz not null default now()
);

alter table public.gyms enable row level security;
alter table public.gym_cells enable row level security;

revoke all on table public.gyms from anon, authenticated;
revoke all on table public.gym_cells from anon, authenticated;
grant select on table public.gyms to anon, authenticated;
-- This project gives service_role no default access to new tables.
grant select, insert, update, delete on table public.gyms to service_role;
grant select, insert, update, delete on table public.gym_cells to service_role;

create policy "Anyone can read gyms" on public.gyms for select to anon, authenticated using (true);

-- Gyms within a radius, nearest first.
create function public.nearby_gyms(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit int default 300
)
returns setof public.gyms
language sql
stable
set search_path = ''
as $$
  select g.*
  from public.gyms g
  where g.latitude between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and g.longitude between p_lng - p_radius_km / (111.32 * greatest(cos(radians(p_lat)), 0.01))
                        and p_lng + p_radius_km / (111.32 * greatest(cos(radians(p_lat)), 0.01))
    and 2 * 6371 * asin(sqrt(
          power(sin(radians(g.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(g.latitude)) * power(sin(radians(g.longitude - p_lng) / 2), 2)
        )) <= p_radius_km
  order by 2 * 6371 * asin(sqrt(
          power(sin(radians(g.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(g.latitude)) * power(sin(radians(g.longitude - p_lng) / 2), 2)
        ))
  limit least(p_limit, 500);
$$;

grant execute on function public.nearby_gyms(double precision, double precision, double precision, int)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

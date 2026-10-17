-- Our own copy of outdoor crags, between the app and OpenBeta.
--
-- The `crags` Edge Function answers "crags near here" from this table and
-- refreshes an area from OpenBeta (public domain, CC0) when it hasn't been
-- fetched in the last week, so one OpenBeta outage doesn't empty the Crags
-- list. crag_cells remembers which areas were fetched and when.
-- Anyone can read crags; only the function (service_role) writes.

create table public.crags (
  id text primary key,                       -- "openbeta:<uuid>", same ids the app already uses
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_boulder boolean not null default false,
  climb_count int not null default 0,
  region text,
  path text[] not null default '{}',
  source_id text,
  fetched_at timestamptz not null default now()
);

create index crags_position on public.crags (latitude, longitude);

create table public.crag_cells (
  cell text primary key,
  fetched_at timestamptz not null default now()
);

alter table public.crags enable row level security;
alter table public.crag_cells enable row level security;

revoke all on table public.crags from anon, authenticated;
revoke all on table public.crag_cells from anon, authenticated;
grant select on table public.crags to anon, authenticated;
-- This project gives service_role no default access to new tables.
grant select, insert, update, delete on table public.crags to service_role;
grant select, insert, update, delete on table public.crag_cells to service_role;

create policy "Anyone can read crags" on public.crags for select to anon, authenticated using (true);

-- Crags within a radius, nearest first.
create function public.nearby_crags(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit int default 300
)
returns setof public.crags
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.crags c
  where c.latitude between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and c.longitude between p_lng - p_radius_km / (111.32 * greatest(cos(radians(p_lat)), 0.01))
                        and p_lng + p_radius_km / (111.32 * greatest(cos(radians(p_lat)), 0.01))
    and 2 * 6371 * asin(sqrt(
          power(sin(radians(c.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(c.latitude)) * power(sin(radians(c.longitude - p_lng) / 2), 2)
        )) <= p_radius_km
  order by 2 * 6371 * asin(sqrt(
          power(sin(radians(c.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(c.latitude)) * power(sin(radians(c.longitude - p_lng) / 2), 2)
        ))
  limit least(p_limit, 500);
$$;

grant execute on function public.nearby_crags(double precision, double precision, double precision, int)
  to anon, authenticated, service_role;

-- Removes crags inside a box that weren't seen in a refresh that started at
-- p_before (OpenBeta no longer lists them). Returns how many.
create function public.prune_crags(
  p_south double precision, p_west double precision, p_north double precision, p_east double precision, p_before timestamptz
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.crags c
  where c.fetched_at < p_before
    and c.latitude between p_south and p_north
    and c.longitude between p_west and p_east;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.prune_crags(double precision, double precision, double precision, double precision, timestamptz) from public, anon, authenticated;
grant execute on function public.prune_crags(double precision, double precision, double precision, double precision, timestamptz) to service_role;

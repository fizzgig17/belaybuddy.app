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
  fetched_at timestamptz not null default now(),
  -- Last scheduled attempt, so a cell Overpass keeps failing on can't starve the rest.
  last_try_at timestamptz
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

-- Removes OSM gyms inside a circle that weren't seen in a refresh that started
-- at p_before (they're gone from OpenStreetMap). Returns how many.
create function public.prune_gyms(
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
  delete from public.gyms g
  where g.source = 'osm'
    and g.fetched_at < p_before
    and g.latitude between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and 2 * 6371 * asin(sqrt(
          power(sin(radians(g.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(g.latitude)) * power(sin(radians(g.longitude - p_lng) / 2), 2)
        )) <= p_radius_km;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.prune_gyms(double precision, double precision, double precision, timestamptz) from public, anon, authenticated;
grant execute on function public.prune_gyms(double precision, double precision, double precision, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Scheduled refresh: every hour, ask the gyms function to refresh up to three
-- areas that haven't been fetched for six days (oldest first). Uses the same
-- Vault secrets as notifications; does nothing until the functions workflow
-- has set them. (pg_net and pg_cron come from the notifications migration.)
-- ---------------------------------------------------------------------------
create function public.refresh_gym_cells()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_cells text[];
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  select coalesce(array_agg(c.cell), '{}') into v_cells
  from (
    select cell from public.gym_cells
    where fetched_at < now() - interval '6 days'
      and (last_try_at is null or last_try_at < now() - interval '6 hours')
    order by fetched_at
    limit 3
  ) c;
  if cardinality(v_cells) = 0 then
    return;
  end if;
  perform net.http_post(
    url := replace(v_url, '/functions/v1/notify', '/functions/v1/gyms'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('refreshCells', to_jsonb(v_cells)),
    timeout_milliseconds := 120000
  );
exception when others then
  raise warning 'refresh_gym_cells: %', sqlerrm;
end;
$$;

revoke execute on function public.refresh_gym_cells() from public, anon, authenticated;

select cron.schedule('belay-buddy-gym-refresh', '20 * * * *', 'select public.refresh_gym_cells()');

notify pgrst, 'reload schema';

-- Regions where a bulk source (Overture Maps) has loaded every climbing gym, so a
-- search there is answered from our own table without asking Overpass.
-- Only the gyms function and the import workflow (service_role) use it.
create table public.gym_coverage (
  id text primary key,
  source text not null,
  min_lat double precision not null,
  max_lat double precision not null,
  min_lng double precision not null,
  max_lng double precision not null,
  loaded_at timestamptz not null default now()
);

alter table public.gym_coverage enable row level security;
revoke all on table public.gym_coverage from anon, authenticated;
grant select, insert, update, delete on table public.gym_coverage to service_role;

-- Saved gyms and crags may now come from Overture Maps.
alter table public.favorites drop constraint favorites_source_check;
alter table public.favorites
  add constraint favorites_source_check
  check (source in ('osm', 'overture', 'openbeta', 'mapkit', 'google-places', 'user'));

notify pgrst, 'reload schema';

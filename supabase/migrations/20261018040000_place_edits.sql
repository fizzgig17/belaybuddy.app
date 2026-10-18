-- Community opening hours for gyms and shops that have none.
--   place_edits      suggestions from signed-in users, reviewed by hand (status pending -> approved/rejected)
--   place_overrides  approved values; nearby_gyms / nearby_shops show them in place of the imported value,
--                    so a data refresh (OpenStreetMap, Overture) never wipes them out
-- To approve: Supabase dashboard > Table Editor > place_edits > set status to "approved".

create table public.place_overrides (
  place_id text not null,
  field text not null check (field in ('opening_hours')),
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (place_id, field)
);

alter table public.place_overrides enable row level security;
revoke all on table public.place_overrides from anon, authenticated;
grant select on table public.place_overrides to anon, authenticated;
grant select, insert, update, delete on table public.place_overrides to service_role;
create policy "Anyone can read approved edits" on public.place_overrides for select to anon, authenticated using (true);

create table public.place_edits (
  id bigint generated always as identity primary key,
  place_id text not null check (char_length(place_id) <= 200),
  place_name text check (char_length(place_name) <= 200),
  kind text not null check (kind in ('gym', 'shop')),
  field text not null default 'opening_hours' check (field in ('opening_hours')),
  -- OpenStreetMap opening_hours format, e.g. "Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00"
  value text not null check (value ~ '^[A-Za-z0-9,;: /-]{3,200}$'),
  submitter uuid default auth.uid() references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index place_edits_status on public.place_edits (status, created_at);

alter table public.place_edits enable row level security;
revoke all on table public.place_edits from anon, authenticated;
grant select, insert on table public.place_edits to authenticated;
grant select, insert, update, delete on table public.place_edits to service_role;

create policy "Users send suggestions as themselves" on public.place_edits for insert
  to authenticated with check ((select auth.uid()) = submitter and status = 'pending');
create policy "Users see their own suggestions" on public.place_edits for select
  to authenticated using ((select auth.uid()) = submitter);

-- At most 20 suggestions a day per person.
create function public.limit_place_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.place_edits
      where submitter = new.submitter and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many suggestions today. Try again tomorrow.';
  end if;
  return new;
end;
$$;

create trigger place_edits_limit before insert on public.place_edits
  for each row execute function public.limit_place_edits();

-- Approving a suggestion publishes it.
create function public.publish_place_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.reviewed_at := now();
  if new.status = 'approved' then
    insert into public.place_overrides (place_id, field, value, updated_at)
    values (new.place_id, new.field, new.value, now())
    on conflict (place_id, field) do update set value = excluded.value, updated_at = now();
  end if;
  return new;
end;
$$;

create trigger place_edits_publish before update of status on public.place_edits
  for each row when (old.status is distinct from new.status and new.status in ('approved', 'rejected'))
  execute function public.publish_place_edit();

revoke execute on function public.limit_place_edits() from public, anon, authenticated;
revoke execute on function public.publish_place_edit() from public, anon, authenticated;

-- Same queries as before, but approved hours replace the imported ones.
create or replace function public.nearby_gyms(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit int default 300
)
returns setof public.gyms
language sql
stable
set search_path = ''
as $$
  select g.id, g.name, g.latitude, g.longitude, g.address, g.styles, g.website, g.phone,
         coalesce(o.value, g.opening_hours) as opening_hours, g.source, g.source_id, g.fetched_at
  from public.gyms g
  left join public.place_overrides o on o.place_id = g.id and o.field = 'opening_hours'
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

create or replace function public.nearby_shops(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit int default 300
)
returns setof public.shops
language sql
stable
set search_path = ''
as $$
  select s.id, s.name, s.latitude, s.longitude, s.address, s.website, s.phone,
         coalesce(o.value, s.opening_hours) as opening_hours, s.climbing, s.source, s.source_id, s.fetched_at
  from public.shops s
  left join public.place_overrides o on o.place_id = s.id and o.field = 'opening_hours'
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

notify pgrst, 'reload schema';

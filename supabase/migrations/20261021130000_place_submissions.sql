-- "Tell us about a missing gym, crag or shop": signed-in people send details, the database checks
-- them against the catalogs straight away, and the owner reviews them in the dashboard.
--
--   place_submissions   what people send, plus `findings` (the automatic check) and the review result
--   investigate_place   the check: similar names nearby, whether the area looks loaded, a verdict
--   dash_*              dashboard-only functions (admin AND two-step sign-in, via dash_guard()):
--                       submission queue, hours queue, admin list. They return jsonb.
-- Admin-added places are stored with source 'user' and ids like "user:<uuid>". The refresh jobs only
-- replace rows of their own source, so those survive (prune_crags is narrowed below to make that true).

create function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Words in a place name that actually tell places apart ("Movement", "Brooklyn"), not "climbing gym".
create function public.name_words(p_name text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct w), '{}')
  from unnest(string_to_array(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', ' ', 'g'), ' ')) as w
  where char_length(w) >= 3
    and w <> all (array['climbing', 'climb', 'gym', 'gyms', 'rock', 'rocks', 'boulder', 'boulders', 'bouldering',
                        'the', 'and', 'center', 'centre', 'fitness', 'wall', 'walls', 'indoor', 'outdoor',
                        'club', 'inc', 'llc', 'crag', 'crags', 'shop', 'store', 'outfitters', 'outdoors']);
$$;

create table public.place_submissions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  submitter uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('gym', 'crag', 'shop')),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  address text check (char_length(address) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  website text check (char_length(website) <= 300),
  phone text check (char_length(phone) <= 40),
  hours_text text check (char_length(hours_text) <= 400),
  notes text check (char_length(notes) <= 1500),
  searched_for text check (char_length(searched_for) <= 200),
  status text not null default 'pending' check (status in ('pending', 'added', 'duplicate', 'rejected')),
  findings jsonb,
  admin_note text check (char_length(admin_note) <= 500),
  resolved_place_id text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  check ((latitude is null) = (longitude is null))
);

create index place_submissions_status on public.place_submissions (status, created_at);

alter table public.place_submissions enable row level security;
revoke all on table public.place_submissions from anon, authenticated;
-- People may only fill in their own details; the review columns and findings are not theirs to write.
grant insert (kind, name, address, latitude, longitude, website, phone, hours_text, notes, searched_for)
  on table public.place_submissions to authenticated;
grant select (id, created_at, kind, name, address, status, findings, resolved_place_id)
  on table public.place_submissions to authenticated;
grant select, insert, update, delete on table public.place_submissions to service_role;

create policy "Send a submission as yourself" on public.place_submissions for insert
  to authenticated with check ((select auth.uid()) = submitter);
create policy "See your own submissions" on public.place_submissions for select
  to authenticated using ((select auth.uid()) = submitter);

-- The check. Looks at the three catalogs, so it works for any kind. Internal: not callable from the API.
create function public.investigate_place(
  p_kind text, p_name text, p_lat double precision, p_lng double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_words text[] := public.name_words(p_name);
  v_has_point boolean := p_lat is not null and p_lng is not null;
  v_matches jsonb := '[]';
  v_nearest jsonb := '[]';
  v_near_count int := 0;
  v_covered boolean := false;
  v_pending_dupes int := 0;
  v_close boolean;
  v_verdict text;
  v_summary text;
  v_tips text[] := '{}';
begin
  -- Same or similar names (any kind, so a gym sent as a shop is noticed). Near the point if we have one.
  select coalesce(jsonb_agg(m order by m ->> 'sort'), '[]') into v_matches
  from (
    select jsonb_build_object('kind', c.kind, 'id', c.id, 'name', c.name, 'source', c.source,
                              'distance_km', round(c.d::numeric, 2), 'sort', lpad(coalesce(c.d, 99999)::int::text, 6, '0')) as m
    from (
      select * from (
        select 'gym' as kind, g.id, g.name, g.source, g.latitude, g.longitude from public.gyms g
        union all select 'shop', s.id, s.name, s.source, s.latitude, s.longitude from public.shops s
        union all select 'crag', cr.id, cr.name, case when cr.id like 'user:%' then 'user' else 'openbeta' end, cr.latitude, cr.longitude from public.crags cr
      ) x
      cross join lateral (
        select case when v_has_point then public.km_between(p_lat, p_lng, x.latitude, x.longitude) end as d
      ) dist
    ) c
    where cardinality(v_words) > 0
      and public.name_words(c.name) && v_words
      and (not v_has_point or c.d <= 30)
    order by c.d nulls last
    limit 5
  ) t;

  v_close := exists (
    select 1 from jsonb_array_elements(v_matches) e
    where (e ->> 'distance_km') is not null and (e ->> 'distance_km')::numeric <= 0.5
  );

  if v_has_point then
    select count(*) into v_near_count from (
      select latitude, longitude from public.gyms where p_kind = 'gym'
      union all select latitude, longitude from public.shops where p_kind = 'shop'
      union all select latitude, longitude from public.crags where p_kind = 'crag'
    ) p
    where p.latitude between p_lat - 0.25 and p_lat + 0.25
      and p.longitude between p_lng - 0.25 / greatest(cos(radians(p_lat)), 0.01) and p_lng + 0.25 / greatest(cos(radians(p_lat)), 0.01)
      and public.km_between(p_lat, p_lng, p.latitude, p.longitude) <= 25;

    select coalesce(jsonb_agg(n), '[]') into v_nearest from (
      select jsonb_build_object('name', q.name, 'distance_km', round(q.d::numeric, 1)) as n
      from (
        select name, public.km_between(p_lat, p_lng, latitude, longitude) as d from public.gyms where p_kind = 'gym'
        union all select name, public.km_between(p_lat, p_lng, latitude, longitude) from public.shops where p_kind = 'shop'
        union all select name, public.km_between(p_lat, p_lng, latitude, longitude) from public.crags where p_kind = 'crag'
      ) q
      where q.d <= 25
      order by q.d
      limit 3
    ) z;

    v_covered := exists (
      select 1 from public.gym_coverage c
      where p_lat between c.min_lat and c.max_lat and p_lng between c.min_lng and c.max_lng
    );

    select count(*) into v_pending_dupes
    from public.place_submissions s
    where s.status = 'pending' and s.kind = p_kind and s.latitude is not null
      and public.km_between(p_lat, p_lng, s.latitude, s.longitude) <= 1
      and public.name_words(s.name) && v_words;
  end if;

  if v_close then
    v_verdict := 'probably_exists';
    v_summary := 'Probably already in the catalog (a similar name within 500 m). It may be hidden by the distance setting, the Gyms/Crags filter, or the person searching under another name.';
    v_tips := array['Open the match and compare name and position.', 'If it is the same place, mark this a duplicate.'];
  elsif not v_has_point then
    v_verdict := 'needs_location';
    v_summary := 'No location was given, so nearby places could not be checked.';
    v_tips := array['Find the position from the address or website, then add it.'];
  elsif jsonb_array_length(v_matches) > 0 then
    v_verdict := 'similar_nearby';
    v_summary := 'A similar name exists within 30 km, but not at this spot. It could be a second location, a rename or a wrong pin.';
    v_tips := array['Check whether the listed place moved or was renamed.'];
  elsif v_near_count = 0 then
    v_verdict := 'area_empty';
    v_summary := case when v_covered
      then 'Nothing of this kind within 25 km, although this region has been fully loaded. The place is likely missing from the open data.'
      else 'Nothing of this kind within 25 km, and this region has not been bulk-loaded. The area may never have been fetched.' end;
    v_tips := array['Add it here so the person sees it now.', 'Consider adding it to OpenStreetMap too, so refreshes keep it.'];
  else
    v_verdict := 'missing';
    v_summary := format('%s other places within 25 km, but none match. Likely missing from the open data.', v_near_count);
    v_tips := array['Add it here so the person sees it now.', 'Consider adding it to OpenStreetMap too, so refreshes keep it.'];
  end if;

  if v_pending_dupes > 0 then
    v_tips := v_tips || format('%s other pending submission(s) look like the same place.', v_pending_dupes);
  end if;

  return jsonb_build_object(
    'verdict', v_verdict, 'summary', v_summary, 'tips', to_jsonb(v_tips),
    'name_matches', v_matches, 'nearest', v_nearest, 'nearby_count', v_near_count,
    'region_covered', v_covered, 'pending_similar', v_pending_dupes, 'checked_at', now());
end;
$$;

revoke execute on function public.investigate_place(text, text, double precision, double precision) from public, anon, authenticated;

-- Runs the check when a submission arrives, and limits each person to 5 a day.
create function public.prepare_place_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.place_submissions
      where submitter = new.submitter and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Too many submissions today. Try again tomorrow.';
  end if;
  new.name := btrim(new.name);
  new.status := 'pending';
  new.findings := public.investigate_place(new.kind, new.name, new.latitude, new.longitude);
  return new;
end;
$$;

create trigger place_submissions_prepare before insert on public.place_submissions
  for each row execute function public.prepare_place_submission();
revoke execute on function public.prepare_place_submission() from public, anon, authenticated;

-- Refreshing crags from OpenBeta must not remove places an admin added by hand.
create or replace function public.prune_crags(
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
    and c.id like 'openbeta:%'
    and c.latitude between p_south and p_north
    and c.longitude between p_west and p_east;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard functions
-- ---------------------------------------------------------------------------

-- Counts for the tab badges.
create function public.dash_queue_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return jsonb_build_object(
    'submissions', (select count(*) from public.place_submissions where status = 'pending'),
    'hours', (select count(*) from public.place_edits where status = 'pending'),
    'reports', (select count(*) from public.reports where status = 'open'),
    'ai_reports', (select count(*) from public.ai_reports where status = 'open'));
end;
$$;

-- Submissions, newest first. p_status: pending | added | duplicate | rejected | all
create function public.dash_submissions(p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.created_at desc)
    from (
      select s.id, s.created_at, s.kind, s.name, s.address, s.latitude, s.longitude, s.website, s.phone,
             s.hours_text, s.notes, s.searched_for, s.status, s.findings, s.admin_note, s.resolved_place_id,
             s.reviewed_at, u.email as submitter_email, coalesce(p.display_name, 'A climber') as submitter_name
      from public.place_submissions s
      left join auth.users u on u.id = s.submitter
      left join public.profiles p on p.id = s.submitter
      where p_status = 'all' or s.status = p_status
      order by s.created_at desc
      limit 200
    ) t), '[]');
end;
$$;

-- Runs the check again (after you fix the position, say).
create function public.dash_recheck_submission(p_id bigint, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.place_submissions;
  out jsonb;
begin
  perform public.dash_guard();
  select * into s from public.place_submissions where id = p_id;
  if not found then raise exception 'No such submission'; end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'Give both latitude and longitude'; end if;
  out := public.investigate_place(s.kind, s.name, coalesce(p_lat, s.latitude), coalesce(p_lng, s.longitude));
  update public.place_submissions
     set findings = out, latitude = coalesce(p_lat, latitude), longitude = coalesce(p_lng, longitude)
   where id = p_id;
  return out;
end;
$$;

-- Marks a submission duplicate or rejected, with a note for yourself.
create function public.dash_resolve_submission(p_id bigint, p_status text, p_note text default null, p_place_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  if p_status not in ('duplicate', 'rejected') then raise exception 'Status must be duplicate or rejected'; end if;
  update public.place_submissions
     set status = p_status, admin_note = left(p_note, 500), resolved_place_id = p_place_id,
         reviewed_at = now(), reviewed_by = (select auth.uid())
   where id = p_id and status = 'pending';
end;
$$;

-- Adds the place to its catalog and closes the submission. Returns the new place id.
create function public.dash_add_submission(
  p_id bigint, p_name text, p_lat double precision, p_lng double precision,
  p_address text default null, p_website text default null, p_phone text default null,
  p_hours text default null, p_is_boulder boolean default false, p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.place_submissions;
  v_id text := 'user:' || gen_random_uuid()::text;
  v_name text := btrim(p_name);
  v_hours text := nullif(btrim(coalesce(p_hours, '')), '');
begin
  perform public.dash_guard();
  select * into s from public.place_submissions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'That submission is not waiting for review'; end if;
  if char_length(v_name) not between 2 and 200 then raise exception 'Name must be 2 to 200 characters'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'A valid latitude and longitude are needed';
  end if;
  if v_hours is not null and v_hours !~ '^[A-Za-z0-9,;: /-]{3,200}$' then
    raise exception 'Hours must be in OpenStreetMap form, like Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00';
  end if;

  if s.kind = 'gym' then
    insert into public.gyms (id, name, latitude, longitude, address, styles, website, phone, opening_hours, source, fetched_at)
    values (v_id, v_name, p_lat, p_lng, nullif(btrim(coalesce(p_address, '')), ''), '{}',
            nullif(btrim(coalesce(p_website, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''), v_hours, 'user', now());
  elsif s.kind = 'shop' then
    insert into public.shops (id, name, latitude, longitude, address, website, phone, opening_hours, climbing, source, fetched_at)
    values (v_id, v_name, p_lat, p_lng, nullif(btrim(coalesce(p_address, '')), ''),
            nullif(btrim(coalesce(p_website, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''), v_hours, true, 'user', now());
  else
    insert into public.crags (id, name, latitude, longitude, is_boulder, climb_count, region, path, fetched_at)
    values (v_id, v_name, p_lat, p_lng, coalesce(p_is_boulder, false), 0, nullif(btrim(coalesce(p_address, '')), ''), '{}', now());
  end if;

  update public.place_submissions
     set status = 'added', resolved_place_id = v_id, admin_note = left(p_note, 500),
         reviewed_at = now(), reviewed_by = (select auth.uid())
   where id = p_id;
  return v_id;
end;
$$;

-- Hours suggestions, with what the catalog shows now. p_status: pending | approved | rejected | all
create function public.dash_hours(p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.created_at desc)
    from (
      select e.id, e.created_at, e.status, e.place_id, e.place_name, e.kind, e.value,
             o.value as approved_value,
             coalesce(g.opening_hours, sh.opening_hours) as imported_value,
             coalesce(g.address, sh.address) as address,
             coalesce(g.website, sh.website) as website,
             u.email as submitter_email, coalesce(p.display_name, 'A climber') as submitter_name
      from public.place_edits e
      left join public.place_overrides o on o.place_id = e.place_id and o.field = e.field
      left join public.gyms g on g.id = e.place_id
      left join public.shops sh on sh.id = e.place_id
      left join auth.users u on u.id = e.submitter
      left join public.profiles p on p.id = e.submitter
      where p_status = 'all' or e.status = p_status
      order by e.created_at desc
      limit 200
    ) t), '[]');
end;
$$;

-- Approving copies the hours into place_overrides (the place_edits_publish trigger does that).
create function public.dash_review_hours(p_id bigint, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  update public.place_edits
     set status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and status = 'pending';
end;
$$;

-- Admins, with emails (the dashboard is owner-only and needs two-step sign-in).
create function public.dash_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.added_at)
    from (
      select a.user_id, u.email, coalesce(p.display_name, 'A climber') as display_name, a.created_at as added_at,
             ab.email as added_by_email, a.user_id = (select auth.uid()) as is_me
      from public.admins a
      left join auth.users u on u.id = a.user_id
      left join public.profiles p on p.id = a.user_id
      left join auth.users ab on ab.id = a.added_by
    ) t), '[]');
end;
$$;

-- Adds the account with this email. Returns its display name, or null if no account uses that email.
create function public.dash_add_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  name text;
begin
  perform public.dash_guard();
  select u.id, coalesce(p.display_name, 'A climber') into target, name
    from auth.users u left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(btrim(p_email))
    limit 1;
  if target is null then return null; end if;
  insert into public.admins (user_id, added_by) values (target, (select auth.uid())) on conflict do nothing;
  return name;
end;
$$;

-- Removes an admin. You cannot remove yourself or the last admin.
create function public.dash_remove_admin(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  if p_user = (select auth.uid()) then raise exception 'You cannot remove yourself. Ask another admin to.'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'There must be at least one admin'; end if;
  delete from public.admins where user_id = p_user;
end;
$$;

revoke execute on function public.dash_queue_counts() from public, anon;
revoke execute on function public.dash_submissions(text) from public, anon;
revoke execute on function public.dash_recheck_submission(bigint, double precision, double precision) from public, anon;
revoke execute on function public.dash_resolve_submission(bigint, text, text, text) from public, anon;
revoke execute on function public.dash_add_submission(bigint, text, double precision, double precision, text, text, text, text, boolean, text) from public, anon;
revoke execute on function public.dash_hours(text) from public, anon;
revoke execute on function public.dash_review_hours(bigint, boolean) from public, anon;
revoke execute on function public.dash_admins() from public, anon;
revoke execute on function public.dash_add_admin(text) from public, anon;
revoke execute on function public.dash_remove_admin(uuid) from public, anon;
grant execute on function public.dash_queue_counts() to authenticated;
grant execute on function public.dash_submissions(text) to authenticated;
grant execute on function public.dash_recheck_submission(bigint, double precision, double precision) to authenticated;
grant execute on function public.dash_resolve_submission(bigint, text, text, text) to authenticated;
grant execute on function public.dash_add_submission(bigint, text, double precision, double precision, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.dash_hours(text) to authenticated;
grant execute on function public.dash_review_hours(bigint, boolean) to authenticated;
grant execute on function public.dash_admins() to authenticated;
grant execute on function public.dash_add_admin(text) to authenticated;
grant execute on function public.dash_remove_admin(uuid) to authenticated;

notify pgrst, 'reload schema';

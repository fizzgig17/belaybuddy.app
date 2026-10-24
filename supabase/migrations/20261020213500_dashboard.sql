-- Owner dashboard (dashboard.fizzgig.app): growth and usage numbers, a user list, bulk delete.
--
-- Everything here is a function the dashboard calls with the signed-in admin's own token. Each one
-- starts with dash_guard(): the caller must be in `admins` AND have signed in with a second step
-- (an authenticator code), so a stolen password alone gets nothing. There is no service-role key
-- anywhere in the dashboard.
--
-- Unlike the in-app Admin screen (which never shows emails), the dashboard shows account emails,
-- because the owner needs to tell test accounts apart before deleting them. Deleting an account
-- works exactly as "Delete my account" does: remove the auth.users row and everything cascades.

create table public.admin_deletion_log (
  id bigint generated always as identity primary key,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,                       -- the admin; no foreign key, so the log outlives accounts
  user_id uuid not null,                 -- the removed account's id (no name or email is kept)
  account_created_at timestamptz,
  via text not null default 'dashboard'
);
alter table public.admin_deletion_log enable row level security;
revoke all on table public.admin_deletion_log from anon, authenticated;
grant select, insert on table public.admin_deletion_log to service_role;

create function public.dash_guard()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then
    raise exception 'Two-step sign-in required';
  end if;
end;
$$;

-- One row per person per day they did anything: signed in, saved a place, posted, logged a climb...
create function public.dash_activity_days()
returns table (user_id uuid, day date)
language sql
stable
security definer
set search_path = ''
as $$
  select id, (last_sign_in_at at time zone 'utc')::date from auth.users where last_sign_in_at is not null
  union select user_id, (logged_at at time zone 'utc')::date from public.climb_logs
  union select user_id, (started_at at time zone 'utc')::date from public.climb_sessions
  union select user_id, (created_at at time zone 'utc')::date from public.belay_posts
  union select user_id, (created_at at time zone 'utc')::date from public.post_responses
  union select sender_id, (created_at at time zone 'utc')::date from public.messages
  union select user_id, (created_at at time zone 'utc')::date from public.favorites
  union select user_id, (created_at at time zone 'utc')::date from public.home_gyms
  union select user_id, (started_at at time zone 'utc')::date from public.checkins
  union select user_id, day from public.route_ai_usage
  union select requester, (created_at at time zone 'utc')::date from public.friendships
$$;
revoke execute on function public.dash_activity_days() from public, anon, authenticated;

create function public.dash_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  out jsonb;
begin
  perform public.dash_guard();
  select jsonb_build_object(
    'generated_at', now(),
    'users', (select count(*) from auth.users),
    'users_confirmed', (select count(*) from auth.users where email_confirmed_at is not null or last_sign_in_at is not null),
    'new_1d', (select count(*) from auth.users where created_at >= now() - interval '1 day'),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'new_prev_7d', (select count(*) from auth.users where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'active_1d', (select count(distinct user_id) from public.dash_activity_days() where day >= today),
    'active_7d', (select count(distinct user_id) from public.dash_activity_days() where day > today - 7),
    'active_30d', (select count(distinct user_id) from public.dash_activity_days() where day > today - 30),
    'profiles_named', (select count(*) from public.profiles where coalesce(display_name, '') <> ''),
    'ai_allowed', (select count(*) from public.profiles where ai_consent = 'allowed'),
    'ai_denied', (select count(*) from public.profiles where ai_consent = 'denied'),
    'favorites', (select count(*) from public.favorites),
    'home_gyms', (select count(*) from public.home_gyms),
    'posts', (select count(*) from public.belay_posts),
    'posts_open', (select count(*) from public.belay_posts where ends_at > now()),
    'responses', (select count(*) from public.post_responses),
    'messages', (select count(*) from public.messages),
    'sessions', (select count(*) from public.climb_sessions),
    'logs', (select count(*) from public.climb_logs),
    'scans', (select coalesce(sum(count), 0) from public.route_ai_usage),
    'friends', (select count(*) from public.friendships where status = 'accepted'),
    'friend_requests_pending', (select count(*) from public.friendships where status = 'pending'),
    'checkins_now', (select count(*) from public.checkins where expires_at > now()),
    'push_ios', (select count(distinct user_id) from public.push_tokens where platform = 'ios'),
    'push_android', (select count(distinct user_id) from public.push_tokens where platform = 'android'),
    'gyms', (select count(*) from public.gyms),
    'crags', (select count(*) from public.crags),
    'shops', (select count(*) from public.shops),
    'pending_edits', (select count(*) from public.place_edits where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'open_ai_reports', (select count(*) from public.ai_reports where status = 'open'),
    'admins', (select count(*) from public.admins)
  ) into out;
  return out;
end;
$$;

-- Daily numbers for the charts, oldest first.
create function public.dash_series(p_days int default 90)
returns table (
  day date, signups int, active int, favorites int, sessions int, logs int,
  posts int, responses int, scans int, friendships int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n int := least(greatest(coalesce(p_days, 90), 7), 730);
begin
  perform public.dash_guard();
  return query
  with days as (
    select d::date as day
    from generate_series((now() at time zone 'utc')::date - (n - 1), (now() at time zone 'utc')::date, interval '1 day') d
  ),
  su as (select (created_at at time zone 'utc')::date d, count(*)::int c from auth.users group by 1),
  ac as (select a.day d, count(distinct a.user_id)::int c from public.dash_activity_days() a group by 1),
  fa as (select (created_at at time zone 'utc')::date d, count(*)::int c from public.favorites group by 1),
  se as (select (started_at at time zone 'utc')::date d, count(*)::int c from public.climb_sessions group by 1),
  lo as (select (logged_at at time zone 'utc')::date d, count(*)::int c from public.climb_logs group by 1),
  po as (select (created_at at time zone 'utc')::date d, count(*)::int c from public.belay_posts group by 1),
  re as (select (created_at at time zone 'utc')::date d, count(*)::int c from public.post_responses group by 1),
  sc as (select r.day d, sum(r.count)::int c from public.route_ai_usage r group by 1),
  fr as (select (created_at at time zone 'utc')::date d, count(*)::int c from public.friendships group by 1)
  select days.day,
         coalesce(su.c, 0), coalesce(ac.c, 0), coalesce(fa.c, 0), coalesce(se.c, 0), coalesce(lo.c, 0),
         coalesce(po.c, 0), coalesce(re.c, 0), coalesce(sc.c, 0), coalesce(fr.c, 0)
  from days
  left join su on su.d = days.day left join ac on ac.d = days.day left join fa on fa.d = days.day
  left join se on se.d = days.day left join lo on lo.d = days.day left join po on po.d = days.day
  left join re on re.d = days.day left join sc on sc.d = days.day left join fr on fr.d = days.day
  order by days.day;
end;
$$;

-- How people sign in, and which phones have the app (by push registration).
create function public.dash_breakdowns()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return jsonb_build_object(
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object('name', provider, 'count', c) order by c desc)
      from (select provider, count(distinct user_id) c from auth.identities group by provider) p), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object('name', goal, 'count', c) order by c desc)
      from (select goal, count(*) c from public.belay_posts group by goal) g), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object('name', result, 'count', c) order by c desc)
      from (select result, count(*) c from public.climb_logs group by result) r), '[]'::jsonb),
    'styles', coalesce((
      select jsonb_agg(jsonb_build_object('name', s, 'count', c) order by c desc)
      from (select unnest(styles) s, count(*) c from public.profiles group by 1) st), '[]'::jsonb)
  );
end;
$$;

-- The places people care about most.
create function public.dash_top_places(p_limit int default 10)
returns table (area_id text, name text, favorites int, home int, posts int, score int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return query
  with f as (select a.area_id, max(a.name) n, count(*)::int c from public.favorites a group by 1),
       h as (select a.area_id, max(a.name) n, count(*)::int c from public.home_gyms a group by 1),
       p as (select a.area_id, max(a.area_name) n, count(*)::int c from public.belay_posts a group by 1),
       ids as (select f.area_id from f union select h.area_id from h union select p.area_id from p)
  select ids.area_id,
         coalesce(f.n, h.n, p.n),
         coalesce(f.c, 0), coalesce(h.c, 0), coalesce(p.c, 0),
         coalesce(f.c, 0) + coalesce(h.c, 0) * 2 + coalesce(p.c, 0)
  from ids
  left join f on f.area_id = ids.area_id left join h on h.area_id = ids.area_id left join p on p.area_id = ids.area_id
  order by 6 desc, 2
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
end;
$$;

-- Weekly sign-up cohorts: of the people who joined that week, how many did something N weeks later.
create function public.dash_retention(p_weeks int default 8)
returns table (cohort date, size int, week_offset int, active int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n int := least(greatest(coalesce(p_weeks, 8), 2), 26);
  this_week date := date_trunc('week', now() at time zone 'utc')::date;
begin
  perform public.dash_guard();
  return query
  with cohort_users as (
    select id, date_trunc('week', created_at at time zone 'utc')::date as cohort
    from auth.users
    where created_at >= (this_week - (n - 1) * 7)::timestamp
  ),
  sizes as (select c.cohort, count(*)::int size from cohort_users c group by 1),
  act as (
    select cu.cohort,
           ((date_trunc('week', a.day::timestamp)::date - cu.cohort) / 7)::int as wk,
           count(distinct cu.id)::int c
    from cohort_users cu
    join public.dash_activity_days() a on a.user_id = cu.id
    where a.day >= cu.cohort
    group by 1, 2
  )
  select s.cohort, s.size, w.wk, coalesce(act.c, 0)
  from sizes s
  cross join lateral generate_series(0, (this_week - s.cohort) / 7) as w(wk)
  left join act on act.cohort = s.cohort and act.wk = w.wk
  order by s.cohort, w.wk;
end;
$$;

-- The user list. Filters are all optional; p_quiet = people who never did anything beyond signing up.
create function public.dash_users(
  p_search text default null,
  p_from date default null,
  p_to date default null,
  p_quiet boolean default false,
  p_sort text default 'created_desc',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  providers text, saved int, sessions int, posts int, friends int, is_admin boolean, total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.dash_guard();
  return query
  with base as (
    select u.id, u.email::text as email, p.display_name, u.created_at, u.last_sign_in_at,
           (select string_agg(i.provider, ', ' order by i.provider) from auth.identities i where i.user_id = u.id) as providers,
           (select count(*)::int from public.favorites f where f.user_id = u.id) as saved,
           (select count(*)::int from public.climb_sessions s where s.user_id = u.id) as sessions,
           (select count(*)::int from public.belay_posts b where b.user_id = u.id) as posts,
           (select count(*)::int from public.friendships fr where fr.status = 'accepted' and u.id in (fr.requester, fr.addressee)) as friends,
           exists (select 1 from public.admins a where a.user_id = u.id) as is_admin
    from auth.users u
    left join public.profiles p on p.id = u.id
    where (q is null or u.email ilike '%' || q || '%' or p.display_name ilike '%' || q || '%' or u.id::text = q)
      and (p_from is null or u.created_at >= p_from::timestamp)
      and (p_to is null or u.created_at < (p_to + 1)::timestamp)
  )
  select b.id, b.email, b.display_name, b.created_at, b.last_sign_in_at, b.providers,
         b.saved, b.sessions, b.posts, b.friends, b.is_admin, count(*) over ()
  from base b
  where not coalesce(p_quiet, false) or (b.saved = 0 and b.sessions = 0 and b.posts = 0 and b.friends = 0)
  order by
    case when p_sort = 'created_asc' then b.created_at end asc,
    case when p_sort = 'seen_desc' then b.last_sign_in_at end desc nulls last,
    case when p_sort = 'email_asc' then lower(b.email) end asc,
    case when p_sort not in ('created_asc', 'seen_desc', 'email_asc') then b.created_at end desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Bulk delete. Admins (including you) are never deleted from here. Returns how many were removed.
create function public.dash_delete_users(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  removed int;
begin
  perform public.dash_guard();
  if p_ids is null or cardinality(p_ids) = 0 then return 0; end if;
  if cardinality(p_ids) > 500 then raise exception 'Delete at most 500 accounts at a time'; end if;
  if me = any (p_ids) then raise exception 'You cannot delete your own account here'; end if;
  if exists (select 1 from public.admins a where a.user_id = any (p_ids)) then
    raise exception 'Admins cannot be deleted here. Remove their admin access first.';
  end if;

  insert into public.admin_deletion_log (deleted_by, user_id, account_created_at)
  select me, u.id, u.created_at from auth.users u where u.id = any (p_ids);

  delete from auth.users where id = any (p_ids);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create function public.dash_deletion_log(p_limit int default 50)
returns table (deleted_at timestamptz, deleted_by_name text, user_id uuid, account_created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.dash_guard();
  return query
  select l.deleted_at, p.display_name, l.user_id, l.account_created_at
  from public.admin_deletion_log l
  left join public.profiles p on p.id = l.deleted_by
  order by l.deleted_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'dash_guard()', 'dash_overview()', 'dash_series(int)', 'dash_breakdowns()', 'dash_top_places(int)',
    'dash_retention(int)', 'dash_users(text, date, date, boolean, text, int, int)',
    'dash_delete_users(uuid[])', 'dash_deletion_log(int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

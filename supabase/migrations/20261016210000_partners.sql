-- Partners: home gyms, the per-gym belay board, "I'm in" responses, session
-- chat, blocking, reporting, public climber cards, the private weight hint,
-- and in-app account deletion. See docs/product-principles.md.
--
-- Access model, as before: RLS on everything, nothing for anon. Other
-- climbers' profiles are never readable directly; the security-definer
-- functions below return only the public fields, and never to someone who
-- has blocked them or been blocked by them.

-- ---------------------------------------------------------------------------
-- Private profile additions
-- ---------------------------------------------------------------------------
-- Optional weight, used only for the lead compatibility hint. Stored rounded
-- to 5 kg, readable only by its owner (profiles' own-row select policy).
alter table public.profiles
  add column weight_kg smallint check (weight_kg between 20 and 200 and weight_kg % 5 = 0),
  add column assisted_braking boolean not null default false;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  -- Name at the time of blocking, so the Blocked list can show who it is
  -- (their card is hidden from the blocker once blocked).
  blocked_name text check (char_length(blocked_name) <= 50),
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.blocks enable row level security;
revoke all on table public.blocks from anon, authenticated;
grant select, insert, delete on table public.blocks to authenticated;

create policy "Users see their own blocks" on public.blocks for select
  to authenticated using ((select auth.uid()) = blocker);
create policy "Users block others" on public.blocks for insert
  to authenticated with check ((select auth.uid()) = blocker);
create policy "Users unblock others" on public.blocks for delete
  to authenticated using ((select auth.uid()) = blocker);

-- True if either person has blocked the other. Security definer so policies
-- can see blocks made *against* the current user without exposing them.
create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- home_gyms: the gyms whose boards a user follows. Snapshot like favorites.
-- ---------------------------------------------------------------------------
create table public.home_gyms (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id text not null check (char_length(area_id) <= 200),
  name text not null check (char_length(name) <= 200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id, area_id)
);

alter table public.home_gyms enable row level security;
revoke all on table public.home_gyms from anon, authenticated;
grant select, insert, delete on table public.home_gyms to authenticated;

create policy "Users see their own home gyms" on public.home_gyms for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "Users add home gyms" on public.home_gyms for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "Users remove home gyms" on public.home_gyms for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- belay_posts: the per-gym board. Posts disappear when their window ends.
-- Only gym and time are stored, never a position.
-- ---------------------------------------------------------------------------
create table public.belay_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id text not null check (char_length(area_id) <= 200),
  area_name text not null check (char_length(area_name) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  here_now boolean not null default false,
  goal text not null check (goal in ('projecting', 'mileage', 'learning-lead', 'top-rope-laps', 'bouldering')),
  styles text[] not null default '{}' check (styles <@ array['bouldering', 'top-rope', 'lead']::text[]),
  grade_low text check (char_length(grade_low) <= 10),
  grade_high text check (char_length(grade_high) <= 10),
  mentoring boolean not null default false,
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours')
);

create index belay_posts_board on public.belay_posts (area_id, ends_at);
create index belay_posts_user on public.belay_posts (user_id, ends_at);

alter table public.belay_posts enable row level security;
revoke all on table public.belay_posts from anon, authenticated;
grant select, insert, delete on table public.belay_posts to authenticated;

create policy "Signed-in users see live posts from people they haven't blocked"
  on public.belay_posts for select
  to authenticated
  using (
    ends_at > now()
    and not public.is_blocked_between((select auth.uid()), user_id)
  );

create policy "Users post for themselves, for a window in the next two weeks"
  on public.belay_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and ends_at > now()
    and starts_at < now() + interval '14 days'
  );

create policy "Users delete their own posts" on public.belay_posts for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Light spam guard: at most 5 upcoming posts per person.
create function public.limit_belay_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.belay_posts where user_id = new.user_id and ends_at > now()) >= 5 then
    raise exception 'You already have 5 upcoming posts. Remove one to add another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_belay_posts() from public, anon, authenticated;

create trigger belay_posts_limit
  before insert on public.belay_posts
  for each row execute function public.limit_belay_posts();

-- ---------------------------------------------------------------------------
-- post_responses: "I'm in". Visible to the responder and the poster.
-- ---------------------------------------------------------------------------
create table public.post_responses (
  post_id uuid not null references public.belay_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_responses_user on public.post_responses (user_id);

alter table public.post_responses enable row level security;
revoke all on table public.post_responses from anon, authenticated;
grant select, insert, delete on table public.post_responses to authenticated;

-- Is the current user the author of this post? (Security definer so the
-- check works on posts that have already expired.)
create function public.is_post_author(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.belay_posts where id = p_post and user_id = (select auth.uid()));
$$;

revoke execute on function public.is_post_author(uuid) from public, anon;
grant execute on function public.is_post_author(uuid) to authenticated;

create policy "Responder and poster see responses" on public.post_responses for select
  to authenticated
  using (
    ((select auth.uid()) = user_id or public.is_post_author(post_id))
    and not public.is_blocked_between((select auth.uid()), user_id)
  );

create policy "Users respond to live posts that aren't their own" on public.post_responses for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      -- The select policy on belay_posts already hides expired posts and
      -- posts from blocked people.
      select 1 from public.belay_posts p
      where p.id = post_id and p.user_id <> (select auth.uid())
    )
  );

create policy "Users withdraw their responses" on public.post_responses for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- messages: a short chat per (post, responder). Open until 2 hours after the
-- session ends, readable for a day after that, then hidden.
-- ---------------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.belay_posts (id) on delete cascade,
  responder_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (post_id, responder_id) references public.post_responses (post_id, user_id) on delete cascade
);

create index messages_thread on public.messages (post_id, responder_id, created_at);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select, insert on table public.messages to authenticated;

-- Can the current user take part in this thread, and is it still open
-- (for reading: within `grace` after the session ends)?
create function public.can_use_thread(p_post uuid, p_responder uuid, grace interval)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.belay_posts p
    join public.post_responses r on r.post_id = p.id and r.user_id = p_responder
    where p.id = p_post
      and (select auth.uid()) in (p.user_id, p_responder)
      and p.ends_at + grace > now()
      and not public.is_blocked_between(p.user_id, p_responder)
  );
$$;

revoke execute on function public.can_use_thread(uuid, uuid, interval) from public, anon;
grant execute on function public.can_use_thread(uuid, uuid, interval) to authenticated;

create policy "Thread members read recent threads" on public.messages for select
  to authenticated
  using (public.can_use_thread(post_id, responder_id, interval '26 hours'));

create policy "Thread members write while the thread is open" on public.messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and public.can_use_thread(post_id, responder_id, interval '2 hours')
  );

-- Live updates in open chats (Realtime still applies the select policy).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- reports: private, write-only for users, reviewed in the dashboard.
-- ---------------------------------------------------------------------------
create table public.reports (
  id bigint generated always as identity primary key,
  -- Reports outlive both accounts, so moderators keep the history.
  reporter uuid default auth.uid() references auth.users (id) on delete set null,
  -- No foreign key: a report outlives the reported account.
  reported uuid not null,
  post_id uuid references public.belay_posts (id) on delete set null,
  reason text not null check (reason in ('unsafe-belay', 'harassment', 'no-show', 'fake', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now(),
  check (reporter <> reported)
);

alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
grant insert on table public.reports to authenticated;

create policy "Users file reports as themselves" on public.reports for insert
  to authenticated with check ((select auth.uid()) = reporter);

-- ---------------------------------------------------------------------------
-- Public climber cards
-- ---------------------------------------------------------------------------
-- The fields other signed-in climbers may see. Never: email, weight, home
-- gyms, or anything about location beyond the free-text home area.
create function public.climber_cards(ids uuid[])
returns table (
  id uuid,
  display_name text,
  bio text,
  home_area text,
  styles text[],
  boulder_grade text,
  route_grade text,
  years_climbing smallint,
  belay_certified text[],
  assisted_braking boolean,
  member_since timestamptz,
  -- Lead compatibility hint between the caller and this climber:
  -- 'similar' | 'some-difference' | 'large-difference' | null (unknown).
  weight_hint text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select weight_kg from public.profiles where id = (select auth.uid())
  )
  select
    p.id, p.display_name, p.bio, p.home_area, p.styles, p.boulder_grade, p.route_grade,
    p.years_climbing, p.belay_certified, p.assisted_braking, p.created_at,
    case
      when p.id = (select auth.uid()) or p.weight_kg is null or me.weight_kg is null then null
      when abs(p.weight_kg - me.weight_kg) < 15 then 'similar'
      when abs(p.weight_kg - me.weight_kg) < 25 then 'some-difference'
      else 'large-difference'
    end
  from public.profiles p
  left join me on true
  where (select auth.uid()) is not null
    and p.id = any (ids)
    and not public.is_blocked_between((select auth.uid()), p.id)
  limit 200;
$$;

revoke execute on function public.climber_cards(uuid[]) from public, anon;
grant execute on function public.climber_cards(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion (required by the App Store). Removing the auth user
-- cascades to every table above.
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

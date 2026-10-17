-- Friends and gym check-ins.
--
-- People add each other with a private friend code (or a link carrying it), or
-- by name among climbers who share a home gym. Friendship needs both people to
-- agree. A check-in ("I'm at <gym>") is opt-in, expires on its own, and only
-- friends can see it, through friends_overview(); never a live position.
--
-- Same access model as the rest of the app: RLS on everything, nothing for
-- anon, and other people's rows are only reachable through the security-definer
-- functions below, which never answer across a block.

-- ---------------------------------------------------------------------------
-- profiles: a private friend code and a "find me" switch
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column friend_code text unique,
  -- Lets climbers who share one of your home gyms find you by name.
  add column discoverable boolean not null default true;

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create function public.make_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
  i int;
begin
  loop
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

revoke execute on function public.make_friend_code() from public, anon, authenticated;

update public.profiles set friend_code = public.make_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;

create function public.profiles_friend_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.friend_code := coalesce(new.friend_code, public.make_friend_code());
  elsif new.friend_code is distinct from old.friend_code and current_user in ('authenticated', 'anon') then
    raise exception 'The friend code cannot be changed';
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_friend_code() from public, anon, authenticated;

create trigger profiles_friend_code
  before insert or update on public.profiles
  for each row execute function public.profiles_friend_code();

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);

-- One row per pair, whichever way round it was asked.
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;
revoke all on table public.friendships from anon, authenticated;
-- Requests and answers go through the functions below; people can only read
-- their own rows and remove them (cancel, decline, unfriend).
grant select, delete on table public.friendships to authenticated;

create policy "People see their own friendships" on public.friendships for select
  to authenticated using ((select auth.uid()) in (requester, addressee));
create policy "People remove their own friendships" on public.friendships for delete
  to authenticated using ((select auth.uid()) in (requester, addressee));

-- Blocking someone ends any friendship or request with them.
create function public.blocks_end_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where (requester = new.blocker and addressee = new.blocked)
     or (requester = new.blocked and addressee = new.blocker);
  return new;
end;
$$;

revoke execute on function public.blocks_end_friendship() from public, anon, authenticated;

create trigger blocks_end_friendship
  after insert on public.blocks
  for each row execute function public.blocks_end_friendship();

-- Failed code tries, so codes can't be guessed.
create table public.friend_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index friend_attempts_user on public.friend_attempts (user_id, at);
alter table public.friend_attempts enable row level security;
revoke all on table public.friend_attempts from anon, authenticated;

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Your own code, to share.
create function public.my_friend_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select friend_code from public.profiles where id = (select auth.uid());
$$;

revoke execute on function public.my_friend_code() from public, anon;
grant execute on function public.my_friend_code() to authenticated;

-- Asks <target> to be friends, or accepts if they already asked you.
-- Returns 'requested', 'accepted' or 'already'.
create function public.request_friendship(p_me uuid, p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.friendships;
begin
  if p_me = p_target then
    raise exception 'That is your own code';
  end if;
  if public.is_blocked_between(p_me, p_target) then
    raise exception 'That did not work';
  end if;

  select * into existing from public.friendships
  where (requester = p_me and addressee = p_target) or (requester = p_target and addressee = p_me);

  if found then
    if existing.status = 'accepted' then
      return 'already';
    elsif existing.requester = p_target then
      update public.friendships set status = 'accepted', responded_at = now() where id = existing.id;
      return 'accepted';
    end if;
    return 'requested';
  end if;

  if (select count(*) from public.friendships where requester = p_me and status = 'pending') >= 30 then
    raise exception 'You have 30 requests waiting. Cancel some first.';
  end if;

  insert into public.friendships (requester, addressee) values (p_me, p_target);
  return 'requested';
end;
$$;

revoke execute on function public.request_friendship(uuid, uuid) from public, anon, authenticated;

-- Add someone with their code. Returns { status, name }; status is 'requested',
-- 'accepted', 'already' or 'invalid' (no such code).
create function public.add_friend_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  target public.profiles;
  result text;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  delete from public.friend_attempts where at < now() - interval '1 day';
  if (select count(*) from public.friend_attempts where user_id = me and at > now() - interval '1 hour') >= 15 then
    raise exception 'Too many tries. Please wait an hour and try again.';
  end if;

  select * into target from public.profiles where friend_code = code;
  if not found or public.is_blocked_between(me, target.id) then
    -- Answer instead of raising, so the failed try is kept (a raise would undo it).
    insert into public.friend_attempts (user_id) values (me);
    return jsonb_build_object('status', 'invalid');
  end if;

  result := public.request_friendship(me, target.id);
  return jsonb_build_object('status', result, 'name', coalesce(target.display_name, 'Climber'));
end;
$$;

revoke execute on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;

-- Climbers who share one of your home gyms and allow it, matched by name.
create function public.find_climbers(p_query text)
returns table (id uuid, display_name text, shared_gym text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (p.id) p.id, p.display_name, mine.name
  from public.home_gyms mine
  join public.home_gyms theirs on theirs.area_id = mine.area_id and theirs.user_id <> mine.user_id
  join public.profiles p on p.id = theirs.user_id
  where mine.user_id = (select auth.uid())
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and p.discoverable
    and p.display_name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
    and not public.is_blocked_between(mine.user_id, p.id)
    and not exists (
      select 1 from public.friendships f
      where (f.requester = mine.user_id and f.addressee = p.id) or (f.requester = p.id and f.addressee = mine.user_id)
    )
  order by p.id
  limit 20;
$$;

revoke execute on function public.find_climbers(text) from public, anon;
grant execute on function public.find_climbers(text) to authenticated;

-- Ask someone you found by name (they must share a home gym with you).
create function public.request_friend(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  if not exists (
    select 1
    from public.home_gyms a
    join public.home_gyms b on b.area_id = a.area_id
    join public.profiles p on p.id = b.user_id
    where a.user_id = me and b.user_id = p_user and p.discoverable
  ) then
    raise exception 'That did not work';
  end if;
  return public.request_friendship(me, p_user);
end;
$$;

revoke execute on function public.request_friend(uuid) from public, anon;
grant execute on function public.request_friend(uuid) to authenticated;

-- Say yes or no to a request someone sent you.
create function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where id = p_id and addressee = (select auth.uid()) and status = 'pending';
  else
    delete from public.friendships
    where id = p_id and addressee = (select auth.uid()) and status = 'pending';
  end if;
end;
$$;

revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Check-ins: "I'm at <gym>", for friends only, gone after a few hours.
-- ---------------------------------------------------------------------------
create table public.checkins (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  area_id text not null check (char_length(area_id) <= 200),
  area_name text not null check (char_length(area_name) <= 200),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.checkins enable row level security;
revoke all on table public.checkins from anon, authenticated;
grant select, delete on table public.checkins to authenticated;

create policy "People see their own check-in" on public.checkins for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "People end their own check-in" on public.checkins for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Checks in (replacing any earlier one) for 1 to 8 hours, 4 by default.
create function public.check_in(p_area_id text, p_area_name text, p_hours int default 4)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  until_at timestamptz := now() + make_interval(hours => greatest(1, least(coalesce(p_hours, 4), 8)));
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  insert into public.checkins (user_id, area_id, area_name, started_at, expires_at)
  values (me, left(p_area_id, 200), left(p_area_name, 200), now(), until_at)
  on conflict (user_id) do update
    set area_id = excluded.area_id, area_name = excluded.area_name,
        started_at = excluded.started_at, expires_at = excluded.expires_at;
  return until_at;
end;
$$;

revoke execute on function public.check_in(text, text, int) from public, anon;
grant execute on function public.check_in(text, text, int) to authenticated;

-- Friends, requests, and where friends are checked in right now.
create function public.friends_overview()
returns table (
  friendship_id uuid,
  other_id uuid,
  display_name text,
  direction text,            -- 'friend' | 'incoming' | 'outgoing'
  since timestamptz,
  area_id text,
  area_name text,
  checked_in_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id,
    o.id,
    coalesce(o.display_name, 'Climber'),
    case
      when f.status = 'accepted' then 'friend'
      when f.addressee = (select auth.uid()) then 'incoming'
      else 'outgoing'
    end,
    coalesce(f.responded_at, f.created_at),
    case when f.status = 'accepted' and c.expires_at > now() then c.area_id end,
    case when f.status = 'accepted' and c.expires_at > now() then c.area_name end,
    case when f.status = 'accepted' and c.expires_at > now() then c.expires_at end
  from public.friendships f
  join public.profiles o on o.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
  left join public.checkins c on c.user_id = o.id
  where (select auth.uid()) in (f.requester, f.addressee)
    and not public.is_blocked_between((select auth.uid()), o.id)
  order by (c.expires_at > now()) desc nulls last, lower(o.display_name);
$$;

revoke execute on function public.friends_overview() from public, anon;
grant execute on function public.friends_overview() to authenticated;

-- Expired check-ins are never shown; tidy them away hourly.
select cron.schedule('belay-buddy-checkin-cleanup', '5 * * * *', 'delete from public.checkins where expires_at < now()');

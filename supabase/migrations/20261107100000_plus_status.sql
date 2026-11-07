-- Belay Buddy Plus on the server. RevenueCat tells the `revenuecat-webhook`
-- function who is subscribed; it writes plus_status; the checks below read it.
--
-- Nothing is enforced until plus_config.enforce is switched on (do that only
-- once the webhook works and Plus is on for every store people can buy from):
--   update public.plus_config set enforce = true;
-- While it is off, everyone counts as Plus, so nothing changes for anyone.

create table public.plus_config (
  id boolean primary key default true check (id),
  enforce boolean not null default false
);
insert into public.plus_config (id) values (true);
alter table public.plus_config enable row level security;
revoke all on table public.plus_config from anon, authenticated;

create table public.plus_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active boolean not null,
  expires_at timestamptz,
  -- RevenueCat's timestamp for the newest event applied, so late or repeated events cannot undo a newer one.
  last_event_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.plus_status enable row level security;
revoke all on table public.plus_status from anon, authenticated;
grant select on table public.plus_status to authenticated;
grant select, insert, update, delete on table public.plus_status to service_role;
create policy "People see their own Plus status" on public.plus_status for select
  to authenticated using ((select auth.uid()) = user_id);

-- True if this person has Plus (or nothing is enforced yet).
create function public.is_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not coalesce((select enforce from public.plus_config limit 1), false)
    or exists (
      select 1 from public.plus_status s
      where s.user_id = p_user and s.active and (s.expires_at is null or s.expires_at > now())
    );
$$;
revoke execute on function public.is_plus(uuid) from public, anon;
grant execute on function public.is_plus(uuid) to authenticated, service_role;

-- The signed-in person's own answer, for the Edge Functions that act for a user.
create function public.my_plus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.is_plus((select auth.uid())); $$;
revoke execute on function public.my_plus() from public, anon;
grant execute on function public.my_plus() to authenticated;

-- Friend limit: free accounts have 5 friends, counting requests they sent.
create function public.enforce_friend_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_used int;
begin
  if tg_op = 'INSERT' then
    v_user := new.requester;
  elsif old.status = 'pending' and new.status = 'accepted' then
    v_user := new.addressee;
  else
    return new;
  end if;
  select count(*) into v_used from public.friendships f
  where f.id is distinct from new.id
    and ((f.status = 'pending' and f.requester = v_user)
      or (f.status = 'accepted' and v_user in (f.requester, f.addressee)));
  if v_used >= 5 and not public.is_plus(v_user) then
    raise exception 'Free accounts can have 5 friends. Belay Buddy Plus removes the limit.';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_friend_limit() from public, anon, authenticated;

create trigger friendships_limit
  before insert or update on public.friendships
  for each row execute function public.enforce_friend_limit();

-- Partner alerts only go to people who have Plus.
create or replace function public.enqueue_alert_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_queue (user_id, kind, post_id, actor_id)
  select h.user_id, 'alert', new.id, new.user_id
  from public.home_gyms h
  join public.notification_settings s on s.user_id = h.user_id
  where h.area_id = new.area_id
    and h.user_id <> new.user_id
    and (s.push_alerts or s.email_alerts)
    and public.is_plus(h.user_id)
    and not public.is_blocked_between(h.user_id, new.user_id);
  return null;
end;
$$;

notify pgrst, 'reload schema';

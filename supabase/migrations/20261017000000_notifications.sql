-- Notifications: per-user settings (push and email per kind), device push
-- tokens, and a queue that the `notify` Edge Function delivers from.
--
--   post_responses insert -> "Alex is in" for the poster
--   messages insert       -> new message for the other person in the thread
--   pg_cron, every minute -> 30-minute reminders for sessions someone joined,
--                            plus a retry kick for anything undelivered
--
-- Delivery: inserting into the queue pings the Edge Function through pg_net.
-- Its URL and shared secret live in Vault (names notify_url, notify_secret);
-- the supabase-functions workflow sets them. Until they exist, nothing is
-- sent and the queue simply waits.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- notification_settings: one row per user, created on first save. Missing
-- row = defaults below.
-- ---------------------------------------------------------------------------
create table public.notification_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  push_responses boolean not null default true,
  push_messages boolean not null default true,
  push_reminders boolean not null default true,
  email_responses boolean not null default true,
  email_messages boolean not null default true,
  email_reminders boolean not null default false,
  -- IANA zone from the device, so times in emails read right ("6:00 PM").
  timezone text check (char_length(timezone) <= 64),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
revoke all on table public.notification_settings from anon, authenticated;
grant select, insert, update on table public.notification_settings to authenticated;

create policy "Users read their notification settings" on public.notification_settings for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their notification settings" on public.notification_settings for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their notification settings" on public.notification_settings for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- push_tokens: APNs device tokens. Managed through the two functions below
-- so a phone that changes hands (sign out, sign in as someone else) moves.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key check (char_length(token) between 32 and 200),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  -- TestFlight and App Store builds use production APNs; local dev builds sandbox.
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from anon, authenticated;

create function public.register_push_token(p_token text, p_platform text, p_environment text default 'production')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  insert into public.push_tokens (token, user_id, platform, environment)
  values (p_token, (select auth.uid()), p_platform, p_environment)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        environment = excluded.environment, updated_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;

revoke execute on function public.register_push_token(text, text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- notification_queue: written by triggers, read only by the Edge Function
-- (service role). Users have no access at all.
-- ---------------------------------------------------------------------------
create table public.notification_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('response', 'message', 'reminder')),
  post_id uuid references public.belay_posts (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete cascade,
  -- For messages: which thread (the responder's id) and a preview.
  thread_responder uuid,
  body text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts smallint not null default 0,
  sent_at timestamptz,
  emailed_at timestamptz,
  error text
);

create index notification_queue_pending on public.notification_queue (id) where sent_at is null;
create index notification_queue_thread_email
  on public.notification_queue (user_id, post_id, thread_responder, emailed_at)
  where kind = 'message';

alter table public.notification_queue enable row level security;
revoke all on table public.notification_queue from anon, authenticated;

alter table public.belay_posts add column reminder_sent boolean not null default false;

-- ---------------------------------------------------------------------------
-- Kick the Edge Function (async, after commit). No-op until Vault is set up.
-- ---------------------------------------------------------------------------
create function public.kick_notifier()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := '{}'::jsonb
  );
exception when others then
  -- Never let a delivery hiccup break the insert that triggered it; the
  -- cron job retries.
  raise warning 'kick_notifier: %', sqlerrm;
end;
$$;

revoke execute on function public.kick_notifier() from public, anon, authenticated;

create function public.notification_queue_kick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Statement triggers also fire for inserts of zero rows (the reminder job
  -- runs every minute); only kick when something was queued.
  if exists (select 1 from inserted) then
    perform public.kick_notifier();
  end if;
  return null;
end;
$$;

revoke execute on function public.notification_queue_kick() from public, anon, authenticated;

create trigger notification_queue_after_insert
  after insert on public.notification_queue
  referencing new table as inserted
  for each statement execute function public.notification_queue_kick();

-- ---------------------------------------------------------------------------
-- Events -> queue
-- ---------------------------------------------------------------------------
create function public.enqueue_response_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_queue (user_id, kind, post_id, actor_id)
  select p.user_id, 'response', p.id, new.user_id
  from public.belay_posts p
  where p.id = new.post_id and p.user_id <> new.user_id;
  return null;
end;
$$;

revoke execute on function public.enqueue_response_notification() from public, anon, authenticated;

create trigger post_responses_notify
  after insert on public.post_responses
  for each row execute function public.enqueue_response_notification();

create function public.enqueue_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.belay_posts where id = new.post_id;
  insert into public.notification_queue (user_id, kind, post_id, actor_id, thread_responder, body)
  values (
    case when new.sender_id = new.responder_id then v_owner else new.responder_id end,
    'message', new.post_id, new.sender_id, new.responder_id, left(new.body, 200)
  );
  return null;
end;
$$;

revoke execute on function public.enqueue_message_notification() from public, anon, authenticated;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.enqueue_message_notification();

-- Reminders 30 minutes before sessions that someone has joined, for the
-- poster and everyone who's in. "Here now" posts don't need one.
create function public.enqueue_reminders()
returns void
language sql
security definer
set search_path = ''
as $$
  with due as (
    update public.belay_posts p
    set reminder_sent = true
    where not p.reminder_sent
      and not p.here_now
      and p.starts_at > now()
      and p.starts_at <= now() + interval '30 minutes'
      and exists (select 1 from public.post_responses r where r.post_id = p.id)
    returning p.id, p.user_id
  )
  insert into public.notification_queue (user_id, kind, post_id)
  select user_id, 'reminder', id from due
  union all
  select r.user_id, 'reminder', d.id from due d join public.post_responses r on r.post_id = d.id;
$$;

revoke execute on function public.enqueue_reminders() from public, anon, authenticated;

-- Every minute: reminders, a retry kick if anything is stuck, and cleanup.
create function public.run_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_reminders();
  if exists (
    select 1 from public.notification_queue
    where sent_at is null and attempts < 5
      and (claimed_at is null or claimed_at < now() - interval '2 minutes')
  ) then
    perform public.kick_notifier();
  end if;
  delete from public.notification_queue where created_at < now() - interval '30 days';
end;
$$;

revoke execute on function public.run_notifications() from public, anon, authenticated;

select cron.schedule('belay-buddy-notifications', '* * * * *', 'select public.run_notifications()');

-- ---------------------------------------------------------------------------
-- For the Edge Function: claim a batch with everything needed to send it.
-- ---------------------------------------------------------------------------
create function public.claim_notifications(max_rows int default 50)
returns table (
  id bigint,
  kind text,
  user_id uuid,
  email text,
  actor_name text,
  post_id uuid,
  thread_responder uuid,
  area_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  here_now boolean,
  goal text,
  body text,
  send_push boolean,
  send_email boolean,
  timezone text
)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.notification_queue q
    set attempts = q.attempts + 1, claimed_at = now()
    where q.id in (
      select n.id from public.notification_queue n
      where n.sent_at is null and n.attempts < 5
        and (n.claimed_at is null or n.claimed_at < now() - interval '2 minutes')
      order by n.id
      limit max_rows
      for update skip locked
    )
    returning q.*
  )
  select
    c.id, c.kind, c.user_id, u.email::text,
    coalesce(nullif(a.display_name, ''), 'A climber'),
    c.post_id, c.thread_responder,
    p.area_name, p.starts_at, p.ends_at, p.here_now, p.goal, c.body,
    case c.kind
      when 'response' then coalesce(s.push_responses, true)
      when 'message' then coalesce(s.push_messages, true)
      else coalesce(s.push_reminders, true)
    end,
    case c.kind
      when 'response' then coalesce(s.email_responses, true)
      -- At most one email per chat thread every 15 minutes.
      when 'message' then coalesce(s.email_messages, true) and not exists (
        select 1 from public.notification_queue o
        where o.kind = 'message' and o.user_id = c.user_id and o.post_id = c.post_id
          and o.thread_responder = c.thread_responder and o.id <> c.id
          and o.emailed_at > now() - interval '15 minutes'
      )
      else coalesce(s.email_reminders, false)
    end,
    s.timezone
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles a on a.id = c.actor_id
  left join public.belay_posts p on p.id = c.post_id
  left join public.notification_settings s on s.user_id = c.user_id
  order by c.id;
$$;

revoke execute on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;

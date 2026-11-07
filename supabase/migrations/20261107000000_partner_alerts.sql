-- Partner alerts (Belay Buddy Plus): a push and/or email when someone posts on
-- the board of one of your home gyms. Opt-in (both switches default off), and
-- the app only lets Plus members turn them on. The database does not know who
-- is subscribed, so, like the tag scan, this is enforced in the app.

alter table public.notification_settings
  add column push_alerts boolean not null default false,
  add column email_alerts boolean not null default false;

alter table public.notification_queue drop constraint notification_queue_kind_check;
alter table public.notification_queue
  add constraint notification_queue_kind_check
  check (kind in ('response', 'message', 'reminder', 'test', 'friend_request', 'friend_accepted', 'alert'));

-- A new post -> one queue row for each follower of that gym who asked for
-- alerts, never the poster and never anyone with a block between them.
create function public.enqueue_alert_notifications()
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
    and not public.is_blocked_between(h.user_id, new.user_id);
  return null;
end;
$$;

revoke execute on function public.enqueue_alert_notifications() from public, anon, authenticated;

create trigger belay_posts_alert
  after insert on public.belay_posts
  for each row execute function public.enqueue_alert_notifications();

-- claim_notifications: alerts use their own switches (default off).
create or replace function public.claim_notifications(max_rows int default 50)
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
      when 'test' then true
      when 'response' then coalesce(s.push_responses, true)
      when 'message' then coalesce(s.push_messages, true)
      when 'friend_request' then coalesce(s.push_friends, true)
      when 'friend_accepted' then coalesce(s.push_friends, true)
      when 'alert' then coalesce(s.push_alerts, false)
      else coalesce(s.push_reminders, true)
    end,
    case c.kind
      when 'test' then true
      when 'response' then coalesce(s.email_responses, true)
      -- At most one email per chat thread every 15 minutes.
      when 'message' then coalesce(s.email_messages, true) and not exists (
        select 1 from public.notification_queue o
        where o.kind = 'message' and o.user_id = c.user_id and o.post_id = c.post_id
          and o.thread_responder = c.thread_responder and o.id <> c.id
          and o.emailed_at > now() - interval '15 minutes'
      )
      when 'friend_request' then coalesce(s.email_friends, true)
      when 'friend_accepted' then coalesce(s.email_friends, true)
      when 'alert' then coalesce(s.email_alerts, false)
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

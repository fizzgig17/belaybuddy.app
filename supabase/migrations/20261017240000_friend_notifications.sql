-- Notifications for friends: a request for the person asked, and an "accepted"
-- for the person who asked. Same push and email channels as everything else,
-- with their own switches (default on).

alter table public.notification_settings
  add column push_friends boolean not null default true,
  add column email_friends boolean not null default true;

alter table public.notification_queue drop constraint notification_queue_kind_check;
alter table public.notification_queue
  add constraint notification_queue_kind_check
  check (kind in ('response', 'message', 'reminder', 'test', 'friend_request', 'friend_accepted'));

create function public.enqueue_friend_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notification_queue (user_id, kind, actor_id)
    values (new.addressee, 'friend_request', new.requester);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notification_queue (user_id, kind, actor_id)
    values (new.requester, 'friend_accepted', new.addressee);
  end if;
  return new;
end;
$$;

revoke execute on function public.enqueue_friend_notification() from public, anon, authenticated;

create trigger friendships_notify
  after insert or update on public.friendships
  for each row execute function public.enqueue_friend_notification();

-- claim_notifications: the friend kinds use the friends switches.
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

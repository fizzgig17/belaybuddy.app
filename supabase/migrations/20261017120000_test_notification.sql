-- "Send me a test notification" (Settings): queues one notification of kind
-- 'test' for the signed-in user. It goes out on both channels whatever the
-- switches say, since the point is to check the whole path works, and the
-- Edge Function records what happened so the app can show it.

alter table public.notification_queue drop constraint notification_queue_kind_check;
alter table public.notification_queue
  add constraint notification_queue_kind_check check (kind in ('response', 'message', 'reminder', 'test'));

-- Devices Apple accepted the push for (null until delivery has been tried).
alter table public.notification_queue add column pushed smallint;

create function public.send_test_notification()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id bigint;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;
  if exists (
    select 1 from public.notification_queue
    where user_id = v_user and kind = 'test' and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'Wait a few seconds before sending another test';
  end if;
  insert into public.notification_queue (user_id, kind) values (v_user, 'test') returning id into v_id;
  return v_id;
end;
$$;

-- What happened to a test the signed-in user sent.
create function public.test_notification_result(p_id bigint)
returns table (done boolean, pushed smallint, emailed boolean, error text)
language sql
security definer
set search_path = ''
as $$
  select q.sent_at is not null, q.pushed, q.emailed_at is not null, q.error
  from public.notification_queue q
  where q.id = p_id and q.kind = 'test' and q.user_id = (select auth.uid());
$$;

revoke execute on function public.send_test_notification() from public, anon;
revoke execute on function public.test_notification_result(bigint) from public, anon;
grant execute on function public.send_test_notification() to authenticated;
grant execute on function public.test_notification_result(bigint) to authenticated;

-- claim_notifications: tests always go out on both channels.
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

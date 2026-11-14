-- Reopen a closed climbing session. Only one session can be open at a time (climb_sessions_one_open),
-- so reopening fails with a plain message while another session is running.
--
-- The time a session was closed is not climbing time: idle_seconds adds up every gap between closing
-- and reopening, and the app subtracts it from the session's length.

alter table public.climb_sessions
  add column if not exists idle_seconds integer not null default 0 check (idle_seconds >= 0);

create or replace function public.reopen_climb_session(p_id uuid)
returns public.climb_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.climb_sessions;
begin
  if exists (select 1 from public.climb_sessions where user_id = (select auth.uid()) and ended_at is null) then
    raise exception 'You already have a session running. End it first.';
  end if;

  update public.climb_sessions
     set idle_seconds = idle_seconds + greatest(0, extract(epoch from (now() - ended_at))::int),
         ended_at = null
   where id = p_id and user_id = (select auth.uid()) and ended_at is not null
  returning * into s;

  if not found then
    raise exception 'That session could not be reopened.';
  end if;
  return s;
exception
  when unique_violation then
    raise exception 'You already have a session running. End it first.';
end;
$$;

revoke execute on function public.reopen_climb_session(uuid) from public, anon;
grant execute on function public.reopen_climb_session(uuid) to authenticated;

notify pgrst, 'reload schema';

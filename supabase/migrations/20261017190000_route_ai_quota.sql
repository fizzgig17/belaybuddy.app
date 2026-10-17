-- Route AI: a small per-person daily limit on technique-tip requests (each one costs a model call).
create table if not exists public.route_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.route_ai_usage enable row level security;
-- No policies: nobody reads or writes this table directly; only take_route_ai_quota() below.

-- Counts one request for the signed-in person. Returns false once they are over today's limit.
create or replace function public.take_route_ai_quota(p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    return false;
  end if;
  insert into public.route_ai_usage as u (user_id, day, count)
  values (v_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  returning u.count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.take_route_ai_quota(int) from public, anon;
grant execute on function public.take_route_ai_quota(int) to authenticated, service_role;
grant select, insert, update, delete on public.route_ai_usage to service_role;

notify pgrst, 'reload schema';

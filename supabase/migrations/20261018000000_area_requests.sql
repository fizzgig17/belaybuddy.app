-- Areas people searched that we haven't saved yet. The gyms function records
-- them; a nightly GitHub workflow (a runner Overpass doesn't block) fetches
-- them from OpenStreetMap and clears the rows, so the next person gets an
-- instant answer. Only the function (service_role) reads or writes this.

create table public.area_requests (
  cell text primary key,                    -- "lat,lng:bucket", same keys as gym_cells
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  hits int not null default 1
);

alter table public.area_requests enable row level security;
revoke all on table public.area_requests from anon, authenticated;
grant select, insert, update, delete on table public.area_requests to service_role;

-- Records a request. Refuses to grow past 2,000 waiting areas so it can't be spammed.
create function public.request_gym_area(p_cell text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cell !~ '^-?\d+(\.\d+)?,-?\d+(\.\d+)?:\d+$' then
    return;
  end if;
  if not exists (select 1 from public.area_requests where cell = p_cell)
     and (select count(*) from public.area_requests) >= 2000 then
    return;
  end if;
  insert into public.area_requests (cell) values (p_cell)
  on conflict (cell) do update set last_requested_at = now(), hits = public.area_requests.hits + 1;
end;
$$;

revoke execute on function public.request_gym_area(text) from public, anon, authenticated;
grant execute on function public.request_gym_area(text) to service_role;

-- The scheduled refresh from inside Supabase can't reach Overpass (blocked), so
-- stop it; the nightly workflow also refreshes areas older than six days.
select cron.unschedule('belay-buddy-gym-refresh');

notify pgrst, 'reload schema';

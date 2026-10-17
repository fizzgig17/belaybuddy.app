-- Climb log: a session is one outing, each log is one climb (or attempt) in it.
-- Private to the climber: nobody else can read these rows.

create table public.climb_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id text check (char_length(area_id) <= 100),
  area_name text check (char_length(area_name) <= 120),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- A climber has at most one session open at a time.
create unique index climb_sessions_one_open on public.climb_sessions (user_id) where ended_at is null;
create index climb_sessions_user_started on public.climb_sessions (user_id, started_at desc);

create table public.climb_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.climb_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  discipline text not null check (discipline in ('boulder', 'route')),
  grade text not null check (char_length(grade) between 1 and 10),
  result text not null check (result in ('send', 'flash', 'attempt')),
  logged_at timestamptz not null default now()
);
create index climb_logs_session on public.climb_logs (session_id, logged_at);
create index climb_logs_user on public.climb_logs (user_id, logged_at desc);

alter table public.climb_sessions enable row level security;
alter table public.climb_logs enable row level security;

revoke all on table public.climb_sessions, public.climb_logs from anon, authenticated;
grant select, insert, update, delete on public.climb_sessions to authenticated;
grant select, insert, delete on public.climb_logs to authenticated;

create policy "Climbers read their sessions" on public.climb_sessions for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "Climbers start sessions" on public.climb_sessions for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "Climbers end their sessions" on public.climb_sessions for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Climbers delete their sessions" on public.climb_sessions for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "Climbers read their climbs" on public.climb_logs for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "Climbers log climbs in their sessions" on public.climb_logs for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.climb_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy "Climbers delete their climbs" on public.climb_logs for delete
  to authenticated using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';

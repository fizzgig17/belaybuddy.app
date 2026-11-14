-- Editing a logged climb, and a wall height on each climb.
--
-- Until now a climb could only be added or deleted. Climbers can now change their own climbs
-- (grade, result, color, name, wall height). A climb's color is either one of the app's list
-- ("red", "teal", ...) or a custom "#RRGGBB"; the existing length check on color already allows both.

alter table public.climb_logs
  add column if not exists wall_height smallint check (wall_height is null or wall_height between 1 and 500);
comment on column public.climb_logs.wall_height is 'Height of the wall or boulder in feet, if recorded.';

grant update on public.climb_logs to authenticated;

create policy "Climbers edit their climbs" on public.climb_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.climb_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

notify pgrst, 'reload schema';

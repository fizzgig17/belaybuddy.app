-- Live updates for the Friends and Partners screens: the app listens for changes
-- to these tables and reloads. Realtime still applies each table's select
-- policy, so people only hear about rows they may read.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['friendships', 'checkins', 'belay_posts', 'post_responses'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

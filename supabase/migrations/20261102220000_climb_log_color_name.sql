-- A logged climb can carry the route's hold color and name (read from its tag or picked by hand).
alter table public.climb_logs
  add column if not exists color text check (color is null or char_length(color) <= 30),
  add column if not exists route_name text check (route_name is null or char_length(route_name) <= 60);

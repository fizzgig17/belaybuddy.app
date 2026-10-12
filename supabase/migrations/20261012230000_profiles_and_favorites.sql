-- Profiles and favorites.
--
-- Access model: every table has row-level security on, nothing is granted to
-- the anonymous role, and each signed-in user can only see and change their
-- own rows. The partner finder will add a narrower policy later for reading
-- other climbers' public profile fields.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  bio text check (char_length(bio) <= 500),
  avatar_url text,
  home_area text check (char_length(home_area) <= 100),
  styles text[] not null default '{}',
  boulder_grade text check (char_length(boulder_grade) <= 10),
  route_grade text check (char_length(route_grade) <= 10),
  years_climbing smallint check (years_climbing between 0 and 90),
  has_gear jsonb not null default '{"rope": false, "quickdraws": false, "rack": false, "crashPad": false}',
  belay_certified text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_styles_valid check (
    styles <@ array['bouldering', 'top-rope', 'lead', 'trad', 'multipitch', 'ice']::text[]
  ),
  constraint profiles_belay_certified_valid check (
    belay_certified <@ array['top-rope', 'lead']::text[]
  )
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
-- Users never insert or delete profiles directly: the trigger below creates
-- them and the foreign key cascade removes them with the account.
grant select, update on table public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile whenever a new account is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- favorites: gyms and crags a user has saved. Areas come from outside sources
-- (MapKit / Google Places / OpenBeta), so we store a snapshot of name and
-- location rather than a foreign key.
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id text not null check (char_length(area_id) <= 200),
  area_kind text not null check (area_kind in ('gym', 'crag')),
  source text not null check (source in ('mapkit', 'google-places', 'openbeta', 'user')),
  name text not null check (char_length(name) <= 200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id, area_id)
);

alter table public.favorites enable row level security;

revoke all on table public.favorites from anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;

create policy "Users can read their own favorites"
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own favorites"
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own favorites"
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- One site-wide information banner, written by admins in the app and shown at the top of every screen.
--   Anyone can read it while it is active. Only admins can change it (through the functions below).
--   `version` goes up each time a new message is published, so a person who closed the old banner
--   sees the new one, but never sees the same one twice.

create table public.site_banner (
  id smallint primary key default 1 check (id = 1),
  message text not null check (char_length(message) between 1 and 500),
  active boolean not null default false,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.site_banner enable row level security;
revoke all on table public.site_banner from anon, authenticated;
grant select on table public.site_banner to anon, authenticated;
grant select, insert, update, delete on table public.site_banner to service_role;
create policy "Anyone can read the active banner" on public.site_banner for select
  to anon, authenticated using (active);

create function public.admin_get_banner()
returns table (message text, active boolean, version bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query select b.message, b.active, b.version from public.site_banner b where b.id = 1;
end;
$$;

create function public.admin_set_banner(p_message text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg text := trim(p_message);
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if char_length(msg) < 1 or char_length(msg) > 500 then
    raise exception 'The message must be 1 to 500 characters';
  end if;
  insert into public.site_banner as b (id, message, active, version, updated_by)
  values (1, msg, p_active, 1, (select auth.uid()))
  on conflict (id) do update
    set message = excluded.message,
        active = excluded.active,
        -- A new message, or turning an old one back on, counts as news again.
        version = case when b.message is distinct from excluded.message or (excluded.active and not b.active)
                       then b.version + 1 else b.version end,
        updated_at = now(),
        updated_by = excluded.updated_by;
end;
$$;

create function public.admin_turn_off_banner()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.site_banner set active = false, updated_at = now(), updated_by = (select auth.uid()) where id = 1;
end;
$$;

revoke execute on function public.admin_get_banner() from public, anon;
revoke execute on function public.admin_set_banner(text, boolean) from public, anon;
revoke execute on function public.admin_turn_off_banner() from public, anon;
grant execute on function public.admin_get_banner() to authenticated;
grant execute on function public.admin_set_banner(text, boolean) to authenticated;
grant execute on function public.admin_turn_off_banner() to authenticated;

notify pgrst, 'reload schema';

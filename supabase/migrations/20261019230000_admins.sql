-- Admins review community opening hours inside the app.
--   admins            who may review. Nobody can read or change this table directly; the app uses the
--                     functions below, which all check is_admin() first.
--   Admins are added by friend code, so there is no browsable list of users. An admin sees a
--   submitter's display name only (never email), and only on the suggestion being reviewed.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;
grant select, insert, update, delete on table public.admins to service_role;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- First admin: the owner's account, if it exists in this project.
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'marc.getter@gmail.com'
on conflict do nothing;

create function public.admin_pending_edits()
returns table (
  id bigint, place_id text, place_name text, kind text, value text,
  current_value text, submitted_by text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select e.id, e.place_id, e.place_name, e.kind, e.value,
           (select o.value from public.place_overrides o where o.place_id = e.place_id and o.field = e.field),
           coalesce(p.display_name, 'A climber'), e.created_at
    from public.place_edits e
    left join public.profiles p on p.id = e.submitter
    where e.status = 'pending'
    order by e.created_at
    limit 100;
end;
$$;

create function public.admin_review_edit(p_id bigint, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  -- The place_edits_publish trigger copies approved hours into place_overrides.
  update public.place_edits
     set status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and status = 'pending';
end;
$$;

create function public.admin_list_admins()
returns table (user_id uuid, display_name text, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select a.user_id, coalesce(p.display_name, 'A climber'), a.user_id = (select auth.uid())
    from public.admins a left join public.profiles p on p.id = a.user_id
    order by a.created_at;
end;
$$;

-- Adds the person who owns this friend code. Returns their display name, or null if no one does.
create function public.admin_add_admin(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  name text;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id, coalesce(display_name, 'A climber') into target, name
    from public.profiles where friend_code = upper(trim(p_code));
  if target is null then return null; end if;
  insert into public.admins (user_id, added_by) values (target, (select auth.uid())) on conflict do nothing;
  return name;
end;
$$;

create function public.admin_remove_admin(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'There must be at least one admin'; end if;
  delete from public.admins where user_id = p_user;
end;
$$;

revoke execute on function public.admin_pending_edits() from public, anon;
revoke execute on function public.admin_review_edit(bigint, boolean) from public, anon;
revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_add_admin(text) from public, anon;
revoke execute on function public.admin_remove_admin(uuid) from public, anon;
grant execute on function public.admin_pending_edits() to authenticated;
grant execute on function public.admin_review_edit(bigint, boolean) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_add_admin(text) to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;

notify pgrst, 'reload schema';

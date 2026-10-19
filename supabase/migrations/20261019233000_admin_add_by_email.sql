-- Admins can also add another admin by the email address on their account.
-- Returns the new admin's display name, or null when no account uses that email. Nothing about the
-- account (not even the email) is returned to the app.
create function public.admin_add_admin_by_email(p_email text)
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
  select u.id, coalesce(p.display_name, 'A climber') into target, name
    from auth.users u left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email))
    limit 1;
  if target is null then return null; end if;
  insert into public.admins (user_id, added_by) values (target, (select auth.uid())) on conflict do nothing;
  return name;
end;
$$;

revoke execute on function public.admin_add_admin_by_email(text) from public, anon;
grant execute on function public.admin_add_admin_by_email(text) to authenticated;

notify pgrst, 'reload schema';

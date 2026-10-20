-- Pressing "Update banner" always counts as news, even when the text is unchanged,
-- so everyone who closed the old one sees it again.
create or replace function public.admin_set_banner(p_message text, p_active boolean)
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
        version = b.version + 1,
        updated_at = now(),
        updated_by = excluded.updated_by;
end;
$$;

notify pgrst, 'reload schema';

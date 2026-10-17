-- How the Edge Function records what happened to a notification. A function
-- (like claim_notifications) rather than a table update, so it doesn't depend
-- on table grants or the API's schema cache.
create function public.finish_notification(
  p_id bigint, p_retry boolean, p_emailed boolean, p_pushed int, p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_queue
  set sent_at = case when p_retry then null else now() end,
      emailed_at = case when p_emailed then now() else emailed_at end,
      pushed = p_pushed::smallint,
      error = left(p_error, 500)
  where id = p_id;
$$;

revoke execute on function public.finish_notification(bigint, boolean, boolean, int, text) from public, anon, authenticated;
grant execute on function public.finish_notification(bigint, boolean, boolean, int, text) to service_role;

notify pgrst, 'reload schema';

-- Tests that were sent before results were being recorded would otherwise be
-- retried (and sent again) forever; close them.
update public.notification_queue set sent_at = now() where kind = 'test' and sent_at is null;

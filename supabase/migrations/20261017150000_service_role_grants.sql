-- The notify Edge Function runs as service_role, which on this project has no
-- default access to tables created by migrations. Without these it can't read
-- push tokens (so no pushes went out) or the queue.
grant select, delete on table public.push_tokens to service_role;
grant select, update on table public.notification_queue to service_role;
notify pgrst, 'reload schema';

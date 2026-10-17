-- Route AI: when the person confirmed that technique tips are suggestions and that they climb at
-- their own risk and judgment. Owner-only, like the rest of profiles.
alter table public.profiles
  add column if not exists tips_ack_at timestamptz;

notify pgrst, 'reload schema';

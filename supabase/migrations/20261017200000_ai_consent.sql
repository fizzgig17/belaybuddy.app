-- Route AI: the person's choice about sending photos to the AI service, and when they made it.
-- Null means they haven't been asked. Readable and writable only by the owner (profiles' own-row
-- policies); the route-tips function reads it with the person's own token before any model call.
alter table public.profiles
  add column if not exists ai_consent text check (ai_consent in ('allowed', 'denied')),
  add column if not exists ai_consent_at timestamptz;

notify pgrst, 'reload schema';

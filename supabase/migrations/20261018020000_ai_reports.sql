-- Reports of AI-generated Route AI tips (wrong, unsafe or inappropriate), reviewed in the dashboard.
-- Write-only for users. Stores the tip text, never the photo.
create table public.ai_reports (
  id bigint generated always as identity primary key,
  reporter uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null default 'route-tip' check (kind in ('route-tip')),
  reason text not null check (reason in ('wrong-or-unsafe', 'offensive', 'off-topic', 'other')),
  details text check (char_length(details) <= 1000),
  content text check (char_length(content) <= 8000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now()
);

alter table public.ai_reports enable row level security;
revoke all on table public.ai_reports from anon, authenticated;
grant insert on table public.ai_reports to authenticated;

create policy "Users file AI reports as themselves" on public.ai_reports for insert
  to authenticated with check ((select auth.uid()) = reporter);

# Supabase is shared with EDC Roulette

Belay Buddy and EDC Roulette (repo `fizzgig17/edcroulette.app`) share the Supabase
projects: its develop branch uses **fizzgig-apps-dev**, its master uses
**fizzgig-apps-prod**. Supabase's free plan allows two active projects per person,
and these two are it.

## What EDC Roulette owns

- Everything in the **`edc` schema** (tables, functions, policies), applied by
  EDC's own workflow (`supabase-edc.yml`) with its own history table
  `edc.schema_migrations`. Belay Buddy's `supabase db push` never sees it.
- The **`edc-gear`** storage bucket and the `edc:`-prefixed policies on
  `storage.objects`.
- Edge Functions whose names start with **`edc-`**.

Belay Buddy's migrations should never create, change or drop anything in the
`edc` schema, the `edc-gear` bucket, or `edc-` functions.

## What is shared

- **Accounts (auth.users).** One sign-in works in both apps. Belay Buddy's
  `handle_new_user` trigger still gives every new account an (empty, private)
  `public.profiles` row, including people who only use EDC Roulette. EDC creates
  its own `edc.profiles` row on first sign-in, so Belay Buddy-only accounts never
  get one.
- **Auth settings.** Both repos *add to* the Sign in with Apple client ids and the
  allowed redirect URLs instead of replacing them: `supabase-auth-providers.yml`
  keeps `app.belaybuddy.ios` first and preserves `app.edcroulette.ios`, and EDC's
  workflow does the same the other way round.
- **The Data API's exposed schemas** include `edc` (set by EDC's workflow).
- **Free-plan limits** (database size, storage, egress) cover both apps.

## Still to handle before EDC Roulette launches sign-in

- The owner dashboard counts every auth user, so EDC-only accounts would show as
  Belay Buddy users.
- "Delete my account" removes the shared account, and with it the person's EDC
  Roulette data. The wording should say so for people who use both apps.

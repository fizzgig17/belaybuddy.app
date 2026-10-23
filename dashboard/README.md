# Belay Buddy dashboard

Owner-only site at https://dashboard.belaybuddy.app. Static files (no build step); one copy manages both
the production and dev Supabase projects through a switch at the top.

- **Sign-in:** emailed code, then an authenticator-app code (2-step). Only accounts in `admins` work.
  "Keep me signed in" (default on) stays signed in for up to 7 quiet days (30 days at most); switched off, the
  session ends with the tab. On iPhone, set the authenticator code up in the Passwords app: the code then fills in
  with Face ID. (Supabase does not support Face ID/WebAuthn as a 2-step factor on hosted projects yet, 422
  "Enabling of MFA with WebAuthn not currently supported", so this is the closest option.)
- **Tabs:** Overview (numbers and charts), Users (list and bulk delete), Suggestions (missing gyms, crags and
  shops people send from the app/website, each with an automatic check; add to the catalog, mark duplicate,
  reject, re-check a corrected position), Hours (approve or reject opening-hours suggestions), Admins (add by
  email, remove; you cannot remove yourself or the last admin), Deleted accounts (log), and **EDC Roulette** (usage of that app's
  optional online features, and the review queue for brands people suggest: approve, merge a misspelling into the
  right brand, reject). Suggestions, Hours and EDC Roulette show a count badge when something is waiting. Migration `20261021130000_place_submissions.sql`.
- **EDC Roulette tab:** its functions (`edc.dash_*`) live in the `edc` schema and are applied by the EDC repo's workflow
  (migration `0003_owner_dashboard.sql`); each calls `public.dash_guard()` first, so the same admins and 2-step
  sign-in apply. Keep `dash_guard()` as it is. Until that app's migration reaches an environment, the tab says so.
- **Security lives in the database:** every number and action is a `dash_*` function (migration
  `20261020213500_dashboard.sql`) that refuses unless the caller is an admin AND signed in with 2-step.
  There is no service-role key anywhere. The publishable keys in `config.js` are public by design.
- **Libraries** are vendored in `vendor/` (supabase-js, d3 7.9.0), so nothing loads from a CDN.
- **Deploy:** `.github/workflows/deploy-dashboard.yml` (master only, when `dashboard/**` changes).
- Try it without a login: none. Test against the fake backend by serving this folder and replacing
  `vendor/supabase.js` with a stub.

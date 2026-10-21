# Belay Buddy dashboard

Owner-only site at https://dashboard.belaybuddy.app. Static files (no build step); one copy manages both
the production and dev Supabase projects through a switch at the top.

- **Sign-in:** emailed code, then Face ID / fingerprint (WebAuthn) or an authenticator-app code (2-step).
  Only accounts in `admins` work. "Keep me signed in" (default on) stays signed in for up to 7 quiet days
  (30 days at most); switched off, the session ends with the tab. The first sign-in on a device offers Face ID;
  `supabase-webauthn.yml` switches WebAuthn on in each Supabase project. Face ID is a second factor on top of the
  emailed code, never a replacement for it.
- **Security lives in the database:** every number and action is a `dash_*` function (migration
  `20261020213500_dashboard.sql`) that refuses unless the caller is an admin AND signed in with 2-step.
  There is no service-role key anywhere. The publishable keys in `config.js` are public by design.
- **Libraries** are vendored in `vendor/` (supabase-js, d3 7.9.0), so nothing loads from a CDN.
- **Deploy:** `.github/workflows/deploy-dashboard.yml` (master only, when `dashboard/**` changes).
- Try it without a login: none. Test against the fake backend by serving this folder and replacing
  `vendor/supabase.js` with a stub.

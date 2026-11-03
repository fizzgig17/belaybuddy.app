# Launch checklist (production)

Pushing to `master` deploys production: Supabase migrations, functions, auth
providers and email templates (fizzgig-apps-prod), the website (belaybuddy.app)
and an iOS TestFlight build that talks to the prod database. `develop` is the
dev copy (orange DEV banner, "Belay Buddy Dev" on the home screen).

## Repository secrets production needs
- PROD_PROJECT_ID, PROD_DB_PASSWORD, SUPABASE_ACCESS_TOKEN
- SPACESHIP_PROD_PATH (document root of belaybuddy.app) plus the existing SPACESHIP_* secrets
- ANTHROPIC_API_KEY (route tag reading), APNS_* (push), SMTP_* (email), DEMO_PASSWORD
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (optional: shows "Continue with Google";
  register https://<prod ref>.supabase.co/auth/v1/callback with Google)

## After the first master push
1. Run "Seed shops" and "Seed gyms" with target = prod.
2. Run "Demo account" with target = prod (App Review login).
3. Check the Supabase functions run's notices (gyms, crags, notify answered).
4. Open https://belaybuddy.app, sign in, and try Find, Shops, a session, Record a route.

## Before submitting to the App Store
- /terms and /privacy were written without a lawyer's review (governing law: North Carolina, set in src/content/terms.ts). Have a lawyer look when there is budget, and keep them in step with the app: update them before a feature sends data somewhere new.
- support@belaybuddy.app mailbox works.
- App Store Connect: privacy policy URL (https://belaybuddy.app/privacy), support URL,
  App Privacy answers (email, user content, coarse location, identifiers for push),
  screenshots, age rating, demo account in the review notes.
- Sign in with Apple capability is on the App ID (the iOS workflow turns it on).

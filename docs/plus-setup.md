# Belay Buddy Plus: setup and switch-on

Plus is built and **off**. Nothing in the app changes until a build has the three settings below. With them missing
(today), `usePlus().isPlus` is true everywhere, the paywall can't be reached and the Plus screens stay hidden.

## What is built
- `src/lib/purchases.ts` (native) and `purchases.web.ts` (the website: no purchases): RevenueCat setup, sign-in sync,
  prices, buy, restore, manage subscription, and `usePlus()` / `requirePlus()`.
- `src/app/paywall.tsx`: the paywall (prices, trial text and legal copy come from the store through RevenueCat).
- Settings: a "Belay Buddy Plus" section (try, manage, restore), hidden while Plus is off.
- Gated: **Scan tag** (tapping without Plus opens the paywall) and a **Progress** card in History (grade pyramid, send
  and flash rates, CSV export; non-Plus people see a teaser with an unlock button).
- `src/content/plus.ts`: the list of features the paywall shows. Only list things that work.

## Not built yet (from the plan)
Partner alerts, advanced partner filters, boosted posts, crews/groups, a friend limit. Add each to `PLUS_FEATURES`
only when it works. Tag scanning is also only gated in the app, not on the server: to enforce it properly, have the
route-tips function check RevenueCat (REST API or a webhook that writes a `plus` flag to `profiles`).

## Setup, in order
1. **Stores.** Finish the Paid Apps agreement and bank/tax forms in App Store Connect and Play Console.
2. **Products.** Create a subscription group with a monthly and a yearly product (suggested $3.99 / $29.99) and a
   7-day free-trial offer, in both stores. Use the same product IDs on both.
3. **RevenueCat.** Create a project, add the iOS app (bundle `app.belaybuddy.ios`) and Android app
   (`app.belaybuddy.android`), connect each store, import the products, create the entitlement **`plus`**, attach the
   products to it, and put both in the default **Offering** as Monthly and Annual packages.
4. **Keys.** Copy the public SDK keys (they start `appl_` and `goog_`). They are meant to ship in the app.
5. **Switch on.** Add the three lines below to wherever the build gets its settings: `config/prod.env` for production
   builds from master (the iOS and Android workflows copy every `EXPO_PUBLIC_*` line from it), and for dev builds the
   same place the dev Supabase values come from (the Xcode Cloud dev workflow's environment variables or `.env`).
   Turn it on in dev first and test there:
   ```
   EXPO_PUBLIC_PLUS_ENABLED=1
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
   ```
6. **Test.** Dev TestFlight build: purchases run in Apple's sandbox at no charge. Android: add your account as a
   license tester in Play Console and use a closed-testing build.
7. **Store forms.** Add purchases to the Apple privacy label and the Play data safety form; give App Review a way to
   test (sandbox purchase works for them). Mention the subscription in the app description, with price, renewal and
   links to the Terms of Use and Privacy Policy (the paywall already shows the renewal text).
8. **Terms and privacy pages.** Add a short subscriptions section (renewal, cancel in store settings, no refunds from
   us: the store handles refunds).

## Plus limits and alerts (built)

- **History window:** free accounts see their latest 10 sessions; older ones stay saved and show a "See all with Plus" card.
- **Friend limit:** free accounts can have 5 friends (requests they sent count). Enforced in `src/lib/friends.ts`.
- **Partner alerts:** opt-in switch in Settings (Plus only), migration `20261107000000_partner_alerts.sql`, delivered by the `notify` function (push on iPhone, email everywhere). Like the tag scan, the database does not check Plus; a RevenueCat webhook would be needed for that.

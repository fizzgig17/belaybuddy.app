# iOS builds on Xcode Cloud

iOS TestFlight builds run on Xcode Cloud (included with the Apple Developer
Program: 25 compute hours a month) instead of GitHub's macOS runners, which use
the free GitHub Actions allowance about 10× faster than Linux.

Day to day nothing changes: put `[ios]` in the commit message (or run
**Actions → Start iOS build on Xcode Cloud** by hand). A small Linux job tells
Xcode Cloud to build that branch. master → production backend, develop → dev
backend and "Belay Buddy Dev" on the home screen, same as before. There are two
Xcode Cloud workflows so each build reaches the right tester group: master
starts **TestFlight Prod**, every other branch starts **TestFlight Dev**.

## How it fits together

| Piece | What it does |
|---|---|
| `.github/workflows/ios-xcode-cloud.yml` | On `[ios]` pushes, calls the App Store Connect API to start **TestFlight Prod** (master) or **TestFlight Dev** (other branches) on that branch. |
| `ios/ci_scripts/ci_post_clone.sh`, `ci_post_xcodebuild.sh` | Entry points Xcode Cloud looks for next to the workspace. Generated — don't edit. |
| `plugins/with-xcode-cloud.js` | Rewrites those two wrappers on every `expo prebuild` (prebuild recreates `ios/` and would otherwise delete them). |
| `scripts/xcode-cloud/post-clone.sh` | Installs Node + CocoaPods, picks the backend, sets build number/team/dev name, runs `expo prebuild` and `pod install`. |
| `scripts/xcode-cloud/post-xcodebuild.sh` | Writes TestFlight's "What to Test" (PRODUCTION/DEVELOPMENT, branch, commit, backend). |
| `.github/workflows/ios-testflight.yml` | The old macOS build, now manual-only as a fallback. |

## One-time setup (on the Mac)

1. Get the project into Xcode once:
   ```bash
   git pull && npm ci
   npx expo prebuild --platform ios
   cd ios && pod install && open BelayBuddy.xcworkspace
   ```
2. In Xcode: **Integrate → Create Workflow…** (Xcode Cloud), pick the
   **BelayBuddy** app, and when asked, grant Xcode Cloud access to the
   `fizzgig17/belaybuddy.app` GitHub repo.
3. Edit the workflow:
   - **Name:** `TestFlight Dev` (the names must match `XCODE_CLOUD_WORKFLOW` in
     `ios-xcode-cloud.yml`).
   - **Start Conditions:** remove the default *Branch Changes* condition so
     pushes don't build on their own; builds come from the GitHub job. Allow
     manual starts for `develop` and `master` (or any branch).
   - **Environment:** latest release of Xcode and macOS. Google and Facebook sign-in buttons
     are on by default (post-clone.sh); to hide one, add the custom variable
     `EXPO_PUBLIC_GOOGLE_SIGNIN=0` or `EXPO_PUBLIC_FACEBOOK_SIGNIN=0`.
   - **Actions:** Archive – iOS, scheme `BelayBuddy`, distribution preparation
     **App Store Connect**.
   - **Post-Actions:** TestFlight Internal Testing → your **dev** tester group.
   - Save, then duplicate the workflow as `TestFlight Prod`: post-action →
     your **prod** tester group, and Manual Start limited to `master`.
4. App Store Connect → Apps → Belay Buddy → **Xcode Cloud → Settings → Build
   Number**: set the next build number to **300**. The last GitHub build was
   248 and TestFlight rejects numbers that aren't higher.
5. Signing is automatic: Xcode Cloud uses Apple-managed certificates, so the
   `.p12`/profile secrets aren't needed for these builds.
6. Test it: **Actions → Start iOS build on Xcode Cloud → Run workflow** on
   `develop`, then watch App Store Connect → Belay Buddy → Xcode Cloud.

After setup, the generated `ios/` folder can stay on the Mac; only
`ios/ci_scripts/` is committed (see `.gitignore`).

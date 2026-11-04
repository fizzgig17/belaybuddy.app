# Google Play: production access and store listing

## 1. Production access application (after the 14-day closed test)
Google asks these questions. Answer truthfully and specifically. Fill the brackets with your real numbers from Play Console (Testing, Closed testing).

**How did you recruit testers?**
I recruited [N] testers through a tester community (AppHive) and [any friends/climbers you asked]. All opted in to the closed test and stayed enrolled for the full 14 days.

**How engaged were testers / summary of feedback?**
Testers installed the app and used it across the 14 days. Most of them did not send written feedback, so I did not rely on that alone. I used the app myself on an Android phone at my gym throughout, watched Play Console (crashes, ANRs, pre-launch report) and Android vitals, and shipped [N] updates during the test.

**What changes did you make during testing?** (all true, from the build history)
- Redesigned the session recorder: round Record button, one-tap Sent / Flash / Attempt, climb beads, History tab, End session dialog.
- Fixed Android layout issues: the profile and record sheets now line up and have their close button beside the tabs, and the keyboard no longer covers fields.
- Added in-app reporting and blocking of climbers, an in-app account deletion option, a support page and a user manual on the website.
- Tightened privacy: AI tag scanning is off until the user turns it on, and photos are not stored.

**Why is the app ready for production?**
It has run for 14 days with no crashes or ANRs reported in Play Console [confirm], the core flows (find a gym, partner posts and chat, session recording, account deletion) all work on a real device, and the privacy policy, support page and data safety form are complete. I will keep monitoring vitals and reviews after launch and ship fixes quickly.

Do not claim feedback or testers you did not have. If Google rejects the application, it tells you why. Fix that, wait for its stated window, and apply again.

## 2. Store listing

**App name** (30): `Belay Buddy`
**Short description** (80): `Find climbing gyms, meet belay partners, and log every send with one tap.`

**Full description** (4000):

```
Belay Buddy is for climbers: find a gym or crag, find someone to climb with, log your sessions, and brush up on safety.

FIND
Search climbing gyms and outdoor crags near you or wherever you are headed. Save favorites and pick your home gyms. Find climbing shops too.

FIND A PARTNER
Post when and where you want to climb, browse posts from climbers at your gym, and chat before you meet. Block or report anyone from their profile.

FRIENDS AND CHECK-INS
Add friends with a code or link, or find people who share your home gym. Check in so friends know where you are climbing. Check-ins end by themselves after a few hours.

RECORD A SESSION
Tap the round button, pick where you are climbing and log each climb with one tap: sent, flash or attempt. Your climbs show up as beads with the grade on each, in the color of the route. Open History to see past sessions.

SCAN A ROUTE TAG (OPTIONAL)
Photograph a route tag and the grade, hold color and name fill in for you. This is optional, it is off until you say yes, and it can be wrong, so check before you log. Tag photos are not stored.

LEARN
Knots, belay safety, pre-climb checklists and gear guides in one place.

YOUR PRIVACY
Location is used only to show nearby places. We never sell your data and there are no ads. You can delete your account any time in Settings, or at belaybuddy.app/delete-account.

Climbing is dangerous. Belay Buddy is a helper, not a substitute for proper instruction or your own judgment.

Questions: support@belaybuddy.app
```

**Category:** Sports (or Health & Fitness). **Tags:** Sports, Social.
**Contact email:** support@belaybuddy.app. **Website:** https://belaybuddy.app. **Privacy policy:** https://belaybuddy.app/privacy

## 3. Graphics (in this folder's delivery)
- App icon 512x512 PNG
- Feature graphic 1024x500 PNG
- Phone screenshots, 2 to 8, 1080x2160 (Play allows up to 2:1): seven provided

## 4. Other forms
- **Content rating (IARC):** user-generated content and chat: Yes. Violence, sex, drugs, gambling: No. Expect Teen-ish.
- **Target audience:** 18 and over (strangers can chat). Not a children's app.
- **Ads:** No.
- **Data safety:** same answers as Apple's privacy label: email and display name (account), coarse location (nearby places), photos only if AI tag scan is turned on (not stored), user content (posts, chat, climbs). Not sold, not used for tracking, encrypted in transit, users can request deletion.
- **Account deletion:** in-app (Settings, Privacy & safety) and web: https://belaybuddy.app/delete-account
- **User-generated content:** reporting and blocking from climber profiles; contact support@belaybuddy.app.
- **Permissions:** location (nearby places), camera (route tag scan, optional).

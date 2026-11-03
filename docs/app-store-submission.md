# App Store submission: Belay Buddy

Everything to paste into App Store Connect, plus what only you can do. Character
limits are Apple's. Version 1.1 (build numbers come from Xcode Cloud).

## 1. Listing text

**Name** (30): `Belay Buddy`
**Subtitle** (30): `Gyms, partners, session log`
**Promotional text** (170, editable any time without review):
`Find a climbing gym, find a partner, and log every send with one tap. New: record a session with the round button and scan route tags.`

**Keywords** (100, comma-separated, no spaces after commas):
`climbing,bouldering,gym,belay,partner,crag,route,send,grade,boulder,knots,chalk,topout,lead,rope`

**Description** (4000):

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
Location is used only to show nearby places, and only a coarse area is sent out. We never sell your data and there are no ads. You can delete your account any time in Settings.

Questions: support@belaybuddy.app
```

**Categories:** Primary Health & Fitness, secondary Sports (or Social Networking).
**Support URL:** https://belaybuddy.app (or a /support page)
**Marketing URL:** https://belaybuddy.app
**Privacy policy URL:** https://belaybuddy.app/privacy
**Copyright:** `2026 <your name or company>`
**What's New (1.1):** `Record a session with the new round button, log each climb with one tap, scan route tags, and see your history. Cleaner look throughout.`

## 2. Age rating
Answer the questionnaire like this; it should land at 12+:
- Unrestricted web access: **No**. User-generated content / messaging: **Yes** (partner board, chat, friends).
- Violence, sexual content, profanity, horror, gambling, drugs, alcohol, medical: **None**.
- Apple also asks if the app has AI or lets users contact each other. Answer **Yes** for contact and chat.

## 3. App Privacy answers ("nutrition label")
Collected, linked to the user, **not** used for tracking:
- **Contact info:** email address (account). Name (display name).
- **User content:** other user content (posts, chats, climb log), photos (route tag photo is sent for reading and not stored: say "collected" only if Apple's wording counts transient processing; it does for the AI service, so list **Photos**).
- **Location:** coarse location (nearby gyms and shops).
- **Identifiers:** device ID / push token (notifications), user ID.
- **Usage data:** none beyond a daily AI scan count (list as product interaction if you want to be strict).
Tracking: **No**. No ad SDKs. Third parties handling data (disclose in the label's third-party question if asked): Supabase, Anthropic (tag photos, opt-in), Apple/Google sign-in.

## 4. App Review information
**Demo account:** `demo@belaybuddy.app` and the password in the DEMO_PASSWORD secret. Run the "Demo account" workflow with target = prod first.
**Notes** (paste):

```
Belay Buddy has no hardware or external device. Sign in with the demo account above (no emailed code needed), or use Sign in with Apple.

Where things are:
- Find tab: climbing gyms and crags near the device. If you are far from any gym, type a place like "Raleigh, NC" in the search box.
- Round Record button (middle of the tab bar): choose "Somewhere else" and tap Start session, then log climbs with Sent / Flash / Attempt. History tab shows past sessions. End session is the button at the bottom of the sheet.
- Scan tag (inside Record) is optional. It asks for permission before sending a photo to an AI service (Anthropic's Claude) and can be declined; everything works without it.
- Partners tab: partner board and Friends. Users can report posts and block climbers from a profile. Reports go to support@belaybuddy.app.
- Profile (top right) > Settings > Privacy & safety: delete account.
Location is requested only to show nearby places (coarse). Camera is requested only to scan a friend's QR code or a route tag.
```

## 5. Guidelines this app touches
- **1.2 User-generated content:** needs report, block, filtering and a contact route. Report posts and block climbers exist; confirm chat messages can be reported too, and that support@ is monitored.
- **4.8 Sign in with Apple:** offered. **5.1.1(v) account deletion:** in Settings.
- **5.1.2 / AI disclosure:** consent before sending tag photos is in the app and the privacy policy.
- **Export compliance:** `ITSAppUsesNonExemptEncryption` is false in app.json (no custom crypto).
- **4.2 minimum functionality:** not a concern; it is a full native app.

## 6. Screenshots
Required: 6.9-inch iPhone (1320 x 2868) and 6.5-inch (1284 x 2778); iPad not needed (`supportsTablet` is false). Use the prod build with the demo account, light mode, no DEV banner. Suggested six, in order:
1. Find (map/list of gyms near a recognisable city)
2. Record sheet start screen
3. Logging a climb with the beads at the bottom
4. History with a session expanded
5. Partners board
6. Learn (knots or safety)

## 7. Before you press submit (needs you)
- [ ] Prod build (version 1.1) processed in TestFlight and tested on your phone
- [ ] Run "Seed gyms", "Seed shops" and "Demo account" with target = prod
- [ ] support@belaybuddy.app mailbox answers
- [ ] Screenshots captured and uploaded
- [ ] Privacy policy at /privacy matches the label above
- [ ] Choose release: manual or automatic after approval
- [ ] Lawyer review of /terms and /privacy when budget allows (not blocking)

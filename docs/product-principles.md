# Belay Buddy product principles

These shape every partner-related feature. When a design choice conflicts with
them, the principles win.

## 1. Close the trust gap

Climbing puts your safety in another person's hands. People don't use partner
apps because they don't trust a stranger to catch them. Matching by grade alone
doesn't fix that; a **social trust layer** does.

- **Safety profile.** Each climber lists belay skills per gym, with how they were
  earned:
  - *Self-reported* ("I can lead belay").
  - *Gym-checked* ("Lead belay certified at Triangle Rock Club"): the user says
    when and where they passed the gym's belay test. Later, gyms can confirm it
    directly (see 2). The UI always shows which kind a claim is.
  - Assisted-braking device experience (GriGri, etc.) and whether they're
    comfortable with heavier partners using an Ohm.
- **Peer endorsements.** After a session, partners can endorse specific,
  observable behaviors, not stars:
  - "Attentive belayer", "Soft catches", "Good partner check", "Gives clear
    commands", "Shows up on time".
  - Endorsements only after a logged session with that person, one per partner
    per skill, and they can be withdrawn. No negative public ratings (they get
    weaponized); safety problems go through **Report**, which is private.
- **Trust is earned on the platform:** new accounts are labeled as new, and
  endorsement counts show how many *different* people vouched, not raw totals.

## 2. Gym first, not city-wide

Global or city-wide matching produces ghosting and dead threads. The unit of
community is **one gym**.

- **Home gyms.** Users pick one or more gyms (from Find). The Partners tab opens
  on their gym, not a map of strangers.
- **Digital belay board.** A per-gym board of posts like "Here now until 8",
  "Coming at 6 PM, want to lead 5.10s", with the climber's safety profile one tap
  away.
  - Posts expire automatically (end of the stated time window).
  - "Here now" is opt-in per post, never automatic or background location.
  - Only signed-in users see the board, and only gym and time are shown, never
    a live position.
- **Lightweight meetups.** "I'm in" on a post opens a short chat for that
  session; the thread closes after the session so nothing goes stale.
- **Later:** gyms can claim their page to post official belay-test results,
  events and partner nights.
- Traveling still works: you pick a gym where you're headed and see its board.

## 3. Match the two bodies, not just the grades

Physical compatibility is a real safety factor, and lopsided sessions are a top
reason meetups don't repeat.

- **Weight compatibility for lead.** A large weight difference changes how a
  lead fall is caught (a lighter belayer can be pulled hard into the wall).
  - Weight is **optional, private and never shown** to anyone. Climbers who
    opt in see only a compatibility hint ("Good weight match for lead", or
    "Consider an Ohm or a ground anchor").
  - Stored as a rounded value, used only for the hint, and deletable at any
    time. Thresholds are framed as guidance, not rules, and reviewed by a
    qualified instructor before launch.
- **Session goals, not just max grade.** Each post states what the session is
  for: projecting, mileage, learning to lead, top-rope laps, bouldering.
  Filters match on the style and a grade *range* ("lead 5.10–5.11"), so a 5.12
  projector and a new 5.8 top-roper aren't paired by accident, unless one of them
  is explicitly offering to mentor.

## Privacy and safety guardrails (apply to all of the above)

- Never show a user's exact location, home address, or real-time position.
- Blocking hides each person from the other everywhere, immediately.
- Reporting is private, reviewed by a person, and can suspend an account.
- Safety content and compatibility guidance carry the "not a substitute for
  instruction" disclaimer and are reviewed by a qualified instructor.
- Required by the App Store for apps where users interact: block, report,
  moderation, and account deletion in the app.

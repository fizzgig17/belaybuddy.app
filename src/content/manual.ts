/** The Belay Buddy user manual, shown at belaybuddy.app/manual. */
export type ManualSection = { id: string; title: string; intro?: string; steps?: string[] };

export const MANUAL_INTRO =
  'A short guide to using Belay Buddy on iPhone and Android. Tabs run along the bottom of the app: Find, Partners, Learn and Shops, with the round button in the middle for recording a session.';

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'account',
    title: 'Getting started',
    intro: 'You can look around without an account. You need one to post, chat, add friends and record sessions.',
    steps: [
      'Open the app and tap the person icon at the top right, then create an account with your email or sign in.',
      'Open Settings (also in the profile sheet) to choose your home gyms, units, and notifications.',
      'Turn on Face ID or a passcode lock in Settings if you want the app to ask before opening.',
    ],
  },
  {
    id: 'find',
    title: 'Find gyms and crags',
    steps: [
      'Open the Find tab. Search a town, park or zip code, or allow location to see places near you.',
      'Tap a place for distance, climbing styles and hours. Tap the heart to save it as a favorite.',
      'Mark a gym as a home gym to see climbers and posts from there on the Partners tab.',
      'Missing a place? Use Suggest a place at the bottom of Find.',
    ],
  },
  {
    id: 'partners',
    title: 'Partners, chat and friends',
    steps: [
      'On the Partners tab, browse posts from climbers at your gyms, or tap New post to say when and where you want to climb.',
      'Open a post to message the climber. Chat before you meet.',
      'Add friends with a code or link from Friends, or find climbers who share your home gym.',
      'Check in at a gym so friends can see where you are climbing.',
      'To report a climber or a post, or to block someone, open their profile and tap Report or Block.',
    ],
  },
  {
    id: 'record',
    title: 'Record a session',
    steps: [
      'Tap the round button in the middle of the tab bar and choose Start session.',
      'Pick Route or Boulder, then tap Sent, Flash or Attempt after each climb. Choose the grade and hold color.',
      'Optional: tap Scan tag and photograph the route tag. The grade, color and name are filled in for you. Scanning only runs if you turn on AI features in Settings, and it can be wrong, so check it before you log.',
      'Each climb appears as a bead along the bottom. Tap a bead to see it, or the trash can to delete it.',
      'Tap the round button again at any time to log your next climb. Tap End session when you are done.',
    ],
  },
  {
    id: 'history',
    title: 'Session history',
    steps: [
      'Open the round button and choose the History tab.',
      'Tap a session to see its climbs. Delete a single climb with its trash can.',
      'Use Select to delete several sessions at once. An Undo bar appears if you change your mind.',
    ],
  },
  {
    id: 'learn',
    title: 'Learn the essentials',
    steps: [
      'The Learn tab has knots, belay safety, pre-climb checklists and gear guides.',
      'These are general guides, not instruction. Learn from a qualified instructor and always do a partner check.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and your account',
    steps: [
      'Location is used only to show nearby places.',
      'AI features are off until you turn them on in Settings.',
      'Delete your account any time in Settings under Privacy & safety. See the delete account page if you cannot sign in.',
    ],
  },
  {
    id: 'help',
    title: 'Need help?',
    intro: 'Email support@belaybuddy.app and a person will reply. Include what you were doing and which phone you use.',
  },
];

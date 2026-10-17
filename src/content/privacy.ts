/**
 * Privacy policy text, shown at /privacy (on the website and in the app). Keep this in step with what the
 * app really does: when a feature starts sending data somewhere new, update it here first.
 */

export const PRIVACY_UPDATED = 'October 17, 2026';
export const PRIVACY_CONTACT = 'support@belaybuddy.app';

export type PolicySection = { title: string; body: string[] };

export const PRIVACY_INTRO =
  'Belay Buddy helps climbers find gyms, find partners, and learn. This page explains what we collect, who handles it, and the choices you have.';

export const PRIVACY_SECTIONS: PolicySection[] = [
  {
    title: 'What we collect',
    body: [
      'Account: your email address, used to sign you in and send notifications you choose. If you sign in with Apple or Google, they tell us your email address (Apple may give a private relay address instead) and a sign-in ID. We never see your Apple or Google password.',
      'Profile and activity: the name and climbing details you add, favorite gyms, home gyms, partner posts and chats, climbing sessions you log, and your notification settings.',
      'Your AI choice: whether you allowed or declined sending photos to the AI service, and when you chose. It is saved on your account, so it follows you to other devices.',
      'Notifications: a device token (so we can send push notifications to your phone) and your time zone (so reminder times read correctly).',
      'Location: when you allow it, your phone uses its location to find gyms and shops near you. We ask our servers for a coarse area, not your exact position.',
    ],
  },
  {
    title: 'Route AI and artificial intelligence',
    body: [
      'Route AI can use an AI service, Anthropic’s Claude, to describe a wall photo and write technique tips. It only does this if you are signed in and have said yes. We ask the first time you use it, save your answer on your account, and check it on our server before every request. You can change your mind any time in Settings under AI features.',
      'What is sent when you use it: the wall photo (resized, with its location data removed), the positions of the holds you confirmed, and, if you used a LiDAR scan, the wall angle and rough distances between holds. We also send a smaller copy of the photo for a quick check of what it shows and whether it is suitable for all ages. Photos that are not suitable are not displayed or used.',
      'What we keep: we do not store your photos or the tips. We keep a simple daily count of how many scans you ran, to limit use. Anthropic handles what it receives under its own terms and privacy policy (anthropic.com/legal/privacy), which can include keeping it for a limited time for safety and abuse prevention.',
      'Finding holds on a photo, and measuring a wall with LiDAR, happen on your phone and do not use the AI service. If you say no, those still work.',
      'Tips are AI-generated. They are one possible way to climb a route, not the only way, and they are not safety instruction or a substitute for a qualified climbing instructor. AI can be wrong.',
    ],
  },
  {
    title: 'Who else handles your data',
    body: [
      'Supabase hosts our database, sign-in, and server functions.',
      'Apple delivers push notifications and distributes the iPhone app.',
      'Our email provider sends sign-in codes and the email notifications you choose.',
      'Apple and Google, if you choose to sign in with them, confirm who you are under their own privacy policies.',
      'OpenStreetMap, through the Overpass service, supplies gym and shop listings, and OpenBeta supplies outdoor crags. We send them a coarse area, never your identity.',
      'Anthropic handles Route AI requests, as described above.',
      'We do not sell your data and we do not show ads.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You can turn AI features off or on in Settings, turn notifications off by type, and remove anything you posted.',
      'You can delete your account in Settings under Privacy and safety. That permanently deletes your profile, favorites, home gyms, posts, chats and logs.',
      'You can block other climbers and report posts.',
    ],
  },
  {
    title: 'Children',
    body: ['Belay Buddy is not directed to children under 13, and we do not knowingly collect their information.'],
  },
  {
    title: 'Changes and contact',
    body: [
      'If this policy changes in a way that matters, we will update the date above and, for new uses of your data such as a new AI feature, ask you first.',
      `Questions or requests: ${PRIVACY_CONTACT}`,
    ],
  },
];

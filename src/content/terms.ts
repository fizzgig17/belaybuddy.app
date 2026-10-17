/**
 * Terms of use, shown at /terms. THIS IS A DRAFT: it must be reviewed by a lawyer before the app is released,
 * and the governing-law placeholder below filled in. While TERMS_IS_DRAFT is true the page says so.
 */

export const TERMS_IS_DRAFT = true;
export const TERMS_UPDATED = 'October 17, 2026';
export const TERMS_CONTACT = 'support@belaybuddy.app';
/** Fill in before release, for example "the State of North Carolina". */
export const TERMS_GOVERNING_STATE = '[STATE]';

export type TermsSection = { title: string; body: string[] };

export const TERMS_INTRO =
  'These terms are the agreement between you and Belay Buddy when you use our website and app. By creating an account or using Belay Buddy, you agree to them. If you do not agree, please do not use it.';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Climbing is dangerous',
    body: [
      'Climbing, bouldering, belaying, and everything around them carry a real risk of serious injury or death. You use Belay Buddy, and climb, at your own risk and judgment.',
      'Belay Buddy is a tool for finding gyms and partners and for learning. It is not instruction, supervision, or a safety check. Nothing in it replaces a qualified climbing instructor, a gym’s staff and rules, or your own judgment. Always follow the rules of the gym or area you are in, and ask staff or an instructor about anything that feels unsafe.',
    ],
  },
  {
    title: 'Route AI and AI-generated content',
    body: [
      'Route AI uses artificial intelligence to describe a wall photo and write technique tips. Tips are AI-generated suggestions about grip and body position, shown as one possible way to climb a route, not the only way.',
      'AI can be wrong. It can misread a hold, miss a hazard, or suggest something that does not suit you. A wall angle or distance measured with LiDAR is approximate. Tips are not safety advice, do not rate difficulty, and are not a promise that any move is possible or safe. You decide whether to try anything, and you are responsible for your own safety.',
      'Route AI is optional. You choose whether to allow it, and you can turn it off in Settings. See our Privacy Policy for what is sent and who handles it.',
    ],
  },
  {
    title: 'Your account',
    body: [
      'You must be at least 13 years old to use Belay Buddy. Give accurate information and keep your sign-in secure. You are responsible for what happens under your account.',
      'You can delete your account at any time in Settings.',
    ],
  },
  {
    title: 'Partners, posts, and chats',
    body: [
      'Belay Buddy can help you find climbing partners. We do not check who anyone is, how skilled they are, whether they are certified, or whether the information they give is true. Meeting or climbing with someone is your choice and your risk. Check a partner’s belay skills yourself before you trust them with your safety, and meet in public places such as a gym.',
      'Do not post anything unlawful, harassing, hateful, sexual, or misleading, and do not impersonate anyone. You can block climbers and report posts. We may remove content or accounts that break these terms.',
      'You keep ownership of what you post. You give us permission to store and show it in Belay Buddy so the service can work.',
    ],
  },
  {
    title: 'Gym, shop, and other information',
    body: [
      'Gym and shop listings, hours, and details come from OpenStreetMap contributors and other sources and may be out of date or wrong. Check with the business before you go. Belay Buddy is not affiliated with, and is not endorsed by, any gym, shop, or brand it lists.',
      'Learning content, including links to Animated Knots by Grog, is general information only. Links lead to other people’s websites, and we are not responsible for them.',
    ],
  },
  {
    title: 'Using Belay Buddy fairly',
    body: [
      'Do not misuse the service: no scraping, no attempts to break or overload it, no use to harass anyone, and no uploading photos that are unlawful or not suitable for all ages. We may limit use, for example the number of Route AI scans a day.',
      'The Belay Buddy name, logo, and app are ours or our licensors’. Do not copy them.',
    ],
  },
  {
    title: 'No warranty',
    body: [
      'Belay Buddy is provided “as is” and “as available,” without warranties of any kind, to the fullest extent the law allows. We do not promise it will be accurate, uninterrupted, or error-free.',
    ],
  },
  {
    title: 'Limit on our responsibility',
    body: [
      'To the fullest extent the law allows, Belay Buddy and the people behind it are not liable for any injury, death, loss, or damage arising from climbing, from meeting other users, or from relying on the app, its tips, its measurements, or its listings. Where the law does not allow a limit to apply, our total responsibility is limited to the greater of what you paid us in the past 12 months or $50.',
      'Some places do not allow these limits, so they may not apply to you in full.',
    ],
  },
  {
    title: 'Ending your use, and changes',
    body: [
      'You can stop using Belay Buddy at any time. We can suspend or end access if you break these terms or to protect other people.',
      'We may update these terms. If a change matters, we will update the date above and, where the law requires it, ask you to agree again. Using Belay Buddy after a change means you accept it.',
    ],
  },
  {
    title: 'Governing law and contact',
    body: [
      `These terms are governed by the laws of ${TERMS_GOVERNING_STATE}, without regard to conflict-of-law rules.`,
      `Questions: ${TERMS_CONTACT}`,
    ],
  },
];

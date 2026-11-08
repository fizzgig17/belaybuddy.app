/** Terms of use, shown at /terms (on the website and in the app). Keep it in step with what the app really does. */

export const TERMS_UPDATED = 'November 8, 2026';
export const TERMS_CONTACT = 'support@belaybuddy.app';
export const TERMS_GOVERNING_STATE = 'the State of North Carolina';

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
    title: 'AI-read route tags',
    body: [
      'When you record a route you can photograph its tag, and artificial intelligence reads the grade, hold color and name from the photo to fill in your log. AI can be wrong, so check what it filled in before you save it.',
      'Reading a tag is optional. You choose whether to allow it, and you can turn it off in Settings. See our Privacy Policy for what is sent and who handles it.',
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
    title: 'Belay Buddy Plus',
    body: [
      'Belay Buddy is free to use. Belay Buddy Plus is an optional subscription that adds extras such as route tag scanning, progress charts and export, unlimited friends, partner alerts, and your full session history. Finding gyms and partners, chat, safety guides and logging your climbs stay free. We may change what Plus includes, and we will not take away anything you have already paid for during the period you paid for.',
      'Plus is billed through Google Play or the App Store, monthly or yearly, at the price shown before you subscribe. It renews automatically until you cancel. Cancel at least 24 hours before the end of the period in your store account settings (Google Play: Subscriptions; App Store: Subscriptions), and you keep Plus until the period ends. A free trial, if offered, turns into a paid subscription at its end unless you cancel first.',
      'Refunds are handled by Google or Apple under their own rules. Plus belongs to your account, so sign in to use it on another phone, or use Restore purchases.',
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
    title: 'Your climb log',
    body: [
      'The climbs you log are for you. We do not show your log to other climbers. You are responsible for its accuracy: a grade or color read from a route tag by AI is only a suggestion until you save it.',
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
      'Do not misuse the service: no scraping, no attempts to break or overload it, no use to harass anyone, and no uploading photos that are unlawful or not suitable for all ages. We may limit use, for example the number of AI tag scans a day.',
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
      'To the fullest extent the law allows, Belay Buddy and the people behind it are not liable for any injury, death, loss, or damage arising from climbing, from meeting other users, or from relying on the app, its tag readings, or its listings. Where the law does not allow a limit to apply, our total responsibility is limited to the greater of what you paid us in the past 12 months or $50.',
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

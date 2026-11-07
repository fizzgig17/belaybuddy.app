/** What Belay Buddy Plus includes. Only list what already works: the paywall must not promise anything unbuilt. */
export const PLUS_FEATURES: { icon: 'camera' | 'history' | 'partnersTab' | 'bell'; title: string; body: string }[] = [
  {
    icon: 'camera',
    title: 'Scan route tags',
    body: 'Photograph a tag and the grade, hold color and name fill in for you.',
  },
  {
    icon: 'history',
    title: 'Progress and export',
    body: 'A grade pyramid, send and flash rates, a spreadsheet export, and your full session history.',
  },
  {
    icon: 'partnersTab',
    title: 'Unlimited friends',
    body: 'Free accounts have 5 friends. Plus has no limit.',
  },
  {
    icon: 'bell',
    title: 'Partner alerts',
    body: 'Get a notification when someone posts on the board at one of your home gyms.',
  },
];

export const PLUS_NAME = 'Belay Buddy Plus';

/** Shown on the website. Store prices vary by country and are always shown in the app itself. */
export const PLUS_PRICE_NOTE =
  'In the US: $2.99 a month or $19.99 a year, with a 7-day free trial. Cancel any time in your store account settings. Prices vary by country and are shown in the app before you subscribe.';
export const PLUS_FREE_NOTE =
  'Everything else stays free: finding gyms and crags, partners and chat, safety guides, and logging your climbs.';
export const PLUS_AVAILABILITY = 'Plus is available on Android now and is coming to iPhone soon.';

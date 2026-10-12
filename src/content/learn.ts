import type { SymbolViewProps } from 'expo-symbols';

/**
 * Learn-section content. This is an outline only: every article must be written
 * or reviewed by a qualified climbing instructor before release, and each one
 * should carry the "not a substitute for instruction" disclaimer.
 */

export type LearnTopicId = 'safety' | 'gear' | 'knots';

export type LearnTopic = {
  id: LearnTopicId;
  title: string;
  summary: string;
  icon: SymbolViewProps['name'];
  /** Planned articles; content to be written. */
  articles: { title: string; summary: string }[];
};

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: 'safety',
    title: 'Climbing safety',
    summary: 'Partner checks, belaying, falling, and gym etiquette.',
    icon: 'checkmark.shield',
    articles: [
      { title: 'Partner check', summary: 'Harness, knot, belay device, and carabiner, every climb.' },
      { title: 'Belaying basics', summary: 'Top-rope and lead belaying, and staying attentive.' },
      { title: 'Bouldering falls', summary: 'Landing, spotting, and pad placement.' },
      { title: 'Gym etiquette', summary: 'Sharing walls, not walking under climbers, and fall zones.' },
      { title: 'Outdoor considerations', summary: 'Helmets, rockfall, weather, and leave-no-trace.' },
    ],
  },
  {
    id: 'gear',
    title: 'Climbing gear',
    summary: 'What you need to start, and how to look after it.',
    icon: 'bag',
    articles: [
      { title: 'Shoes', summary: 'Fit, downturn, and when to resole.' },
      { title: 'Harness', summary: 'Fit, inspection, and retirement.' },
      { title: 'Belay devices', summary: 'Tube-style vs assisted-braking devices.' },
      { title: 'Ropes', summary: 'Diameter, length, dry treatment, and inspection.' },
      { title: 'Helmets, chalk & crash pads', summary: 'The rest of the kit.' },
    ],
  },
  {
    id: 'knots',
    title: 'Knots',
    summary: 'Step-by-step diagrams for the essential climbing knots.',
    icon: 'link',
    articles: [
      { title: 'Figure-eight follow-through', summary: 'The standard tie-in knot.' },
      { title: 'Stopper knot', summary: 'Backing up the tie-in and closing the rope system.' },
      { title: 'Clove hitch', summary: 'Adjustable attachment to a carabiner.' },
      { title: 'Munter hitch', summary: 'Belaying or lowering without a device.' },
      { title: 'Prusik', summary: 'Friction hitch for backups and ascending.' },
    ],
  },
];

export function getLearnTopic(id: string): LearnTopic | undefined {
  return LEARN_TOPICS.find((topic) => topic.id === id);
}

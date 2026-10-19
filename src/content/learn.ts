import type { IconName } from '@/constants/icons';
import { HoldColors } from '@/constants/theme';

/**
 * Learn-section content. Each article is a short summary of what the public
 * sources listed under it say, with links to them. Every article should still be
 * reviewed by a qualified climbing instructor, and the topic page carries the
 * "not a substitute for instruction" disclaimer.
 */

export type LearnTopicId = 'safety' | 'gear' | 'knots';

export type LearnSource = { title: string; url: string };

export type LearnArticle = {
  title: string;
  summary: string;
  /** Opens an external page (e.g. Animated Knots by Grog). */
  url?: string;
  /** Key points, each taken from the sources below. */
  points?: string[];
  /** Public pages the points come from, shown under the article as links. */
  sources?: LearnSource[];
};

export type LearnTopic = {
  id: LearnTopicId;
  title: string;
  summary: string;
  icon: IconName;
  /** Topic color, like route tape in a gym. */
  color: string;
  /** Planned articles; content to be written. */
  articles: LearnArticle[];
  /** Credit line shown under the articles. */
  credit?: { text: string; url: string };
};

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: 'safety',
    title: 'Climbing safety',
    summary: 'Partner checks, belaying, falling, and gym etiquette.',
    icon: 'checklist',
    color: HoldColors.coral,
    articles: [
      {
        title: 'Partner check',
        summary: 'Harness, knot, belay device, and carabiner, every climb.',
        points: [
          'Check each other before every climb, not just the first one of the day.',
          'Harness: fits snugly and the buckles are doubled back.',
          'Knot: a figure-eight with a tail of at least 6 inches. Back it up with a stopper knot at the rope end.',
          'Belay device: threaded the way the maker shows and clipped to the belay loop.',
          'Carabiner: locked. Squeeze it to confirm.',
        ],
        sources: [
          { title: 'EarthTreks: how to belay', url: 'https://earthtreksclimbing.com/how-to-belay-someone-rock-climbing/' },
          { title: 'Petzl: partner check', url: 'https://www.petzl.com/US/en/Sport/PARTNER-CHECK' },
        ],
      },
      {
        title: 'Belaying basics',
        summary: 'Top-rope and lead belaying, and staying attentive.',
        points: [
          'The brake hand stays on the rope at all times. Never let go, even for an itch.',
          'Stand close to the wall and slightly behind your harness, with a balanced stance.',
          'Top rope: keep the rope snug so a fall is mostly rope stretch. Lead: give enough slack to move freely, but not so much that falls get longer.',
          'Stay focused on the climber and ready to lock off the device if they fall.',
          'Use clear, standard commands, and lower the climber in a slow, steady way.',
          'Common mistakes: skipping checks, too much or too little slack, unclear commands, and getting complacent.',
          'Learn belaying hands-on from a qualified instructor. Reading about it is not enough.',
        ],
        sources: [
          { title: 'Climbing House: belaying beginner’s guide', url: 'https://climbinghouse.com/belaying-beginners-guide/' },
          { title: 'EarthTreks: how to belay', url: 'https://earthtreksclimbing.com/how-to-belay-someone-rock-climbing/' },
          { title: 'Petzl: belaying a lead climber (further reading)', url: 'https://www.petzl.com/be/en/sport/tech-tips/basic-techniques/good-practices-for-belaying-a-lead-climber/Escalade---bonnes-pratiques-pour-assurer-en-tete_SPO_a77w0000000GnbNAAS.html' },
        ],
      },
      {
        title: 'Bouldering falls',
        summary: 'Landing, spotting, and pad placement.',
        points: [
          'A spotter guides the climber rather than catching their full weight. The aim is to keep them upright, near the middle of the pads, with head and neck protected.',
          'Spot with your fingers together and thumbs tucked, palms open, knees and elbows slightly bent. Never spread your fingers.',
          'Ask a climber before you spot them.',
          'Fill gaps and holes between pads, and avoid landing on a pad’s hinge gap, especially if there is a rock under it.',
          'Taller falls call for thicker pads. Check the landing zone for rocks and uneven ground.',
        ],
        sources: [
          { title: 'Alpine Institute: spotting a boulderer', url: 'https://www.alpineinstitute.com/spotting-a-boulderer/' },
          { title: 'Public Lands: choosing a bouldering crash pad', url: 'https://www.publiclands.com/blog/a/how-to-choose-a-bouldering-crash-pad' },
          { title: 'Gripped: indoor bouldering etiquette', url: 'https://gripped.com/indoor-climbing/10-rules-for-indoor-bouldering-etiquette/' },
        ],
      },
      {
        title: 'Gym etiquette',
        summary: 'Sharing walls, not walking under climbers, and fall zones.',
        points: [
          'Stay out of the fall zone. Do not walk, sit, or stand under or behind climbers.',
          'Keep bags, bottles, and shoes out of the landing area.',
          'Wait your turn on a problem, and look at where it finishes so you do not run into someone else’s climb.',
          'Brush holds as you go, and tell staff about loose holds.',
          'Do not give advice unless asked, and ask before spotting someone.',
          'Your gym’s own rules come first. Ask the staff if you are unsure.',
        ],
        sources: [{ title: 'Gripped: 10 rules for indoor bouldering etiquette', url: 'https://gripped.com/indoor-climbing/10-rules-for-indoor-bouldering-etiquette/' }],
      },
      {
        title: 'Outdoor considerations',
        summary: 'Helmets, rockfall, weather, and leave-no-trace.',
        points: [
          'Learn outdoor skills from a guide or mentor, and learn the hazards of each cliff before you go.',
          'Wear a helmet, and shout a warning to anyone below if something falls.',
          'Check and back up your anchors, knots, and rappels, and look over your gear regularly.',
          'Stay on established trails, and carry out all your trash, including food scraps.',
          'Brush off chalk and tick marks, keep noise down, and keep gear off plants.',
          'Follow landowner rules, posted regulations, and seasonal closures. Keep dogs leashed where allowed.',
        ],
        sources: [
          { title: 'Gripped: climbers’ code of respect', url: 'https://gripped.com/news/climbing-code-of-respect-for-gym-to-rock-climbers/' },
          { title: 'Friction Labs: 6 rules of outdoor climbing etiquette', url: 'https://frictionlabs.com/blog/6-rules-of-etiquette-for-outdoor-climbing' },
        ],
      },
    ],
  },
  {
    id: 'gear',
    title: 'Climbing gear',
    summary: 'What you need to start, and how to look after it.',
    icon: 'gear',
    color: HoldColors.blue,
    articles: [
      {
        title: 'Shoes',
        summary: 'Fit, shape, and sole thickness.',
        points: [
          'Shoes should fit snug but not painfully. Toes flat or gently curved with no empty space, and a snug heel.',
          'Try them on in the afternoon, when your feet are largest, and look for hot spots.',
          'Neutral (flat): comfortable, a good start for beginners and long days. Moderate: all-purpose for gym and sport. Aggressive (very downturned): for steep terrain, least comfortable.',
          'Stickier rubber and thinner soles wear faster. Thicker soles last longer.',
        ],
        sources: [{ title: 'REI: how to choose rock climbing shoes', url: 'https://www.rei.com/learn/expert-advice/rock-shoes.html' }],
      },
      {
        title: 'Harness',
        summary: 'Care, inspection, and retirement.',
        points: [
          'Thread the buckle the way the maker shows, and leave a tail of about 2 to 3 inches (50 to 75 mm).',
          'Gear loops are for carrying gear only. They are not strong enough to hold a fall.',
          'Inspect the webbing, stitching, tie-in points, and buckles. Look for fading, cuts, fraying, and bends.',
          'Retire a harness with cuts, serious abrasion, or damaged stitching or buckles. Never re-sew it.',
          'With average use a harness lasts about 5 years, and makers set a maximum shelf life of about 10 years. Heavy use can shorten that a lot.',
          'Keep it clean and dry, away from heat, sharp edges, and chemicals.',
        ],
        sources: [{ title: 'UIAA: harness recommendations (PDF)', url: 'https://www.theuiaa.org/documents/safety/Recommendations_Standard_105_BMC.pdf' }],
      },
      {
        title: 'Belay devices',
        summary: 'Tube-style vs assisted-braking devices.',
        points: [
          'Tube-style: friction alone holds the rope. Light, simple, and works with wet ropes, but gives no backup if the belayer lets go.',
          'Assisted-braking (cam): helps hold a fall, with a learning curve. It is heavier, and still needs a brake hand and full attention.',
          'Passive assisted-braking devices are lighter and cheaper than cam devices.',
          'Check the rope diameter range the maker lists before you buy. Tube-style devices take the widest range.',
        ],
        sources: [{ title: 'Public Lands: how to choose a belay or rappel device', url: 'https://www.publiclands.com/blog/a/how-to-choose-the-best-belay-or-rappel-device' }],
      },
      {
        title: 'Ropes',
        summary: 'Diameter, length, dry treatment, and inspection.',
        points: [
          'Under about 9.4 mm: lightest, for long multi-pitch climbs, but less durable. 9.5 to 9.9 mm: a good all-rounder. 10 mm and up: the most durable, best for gym and frequent top-roping.',
          'A 60 m rope is the usual length. Half the rope should be at least the length of the route so you can lower.',
          'Wet ropes are heavier and weaker in a fall. Dry treatment helps in rain, snow, or ice, and matters less for mostly sport climbing.',
          'Inspect a rope closely after a severe fall, and retire it if it is damaged. Follow the maker’s guidance.',
        ],
        sources: [{ title: 'REI: how to choose climbing ropes', url: 'https://www.rei.com/expertadvice/articles/ropes.html' }],
      },
      {
        title: 'Helmets, chalk & crash pads',
        summary: 'The rest of the kit.',
        points: [
          'Helmets: wear one outdoors, where rockfall and dropped gear are a risk.',
          'Chalk: brush off chalk and tick marks when you finish outdoors.',
          'Crash pads: a big pad about 4 inches thick makes a good main landing, and a small pad fills gaps. Polyester resists wear better than nylon.',
          'Hinge and tri-fold pads carry easily. Taco pads suit rocky landings.',
        ],
        sources: [
          { title: 'REI: how to choose climbing helmets', url: 'https://www.rei.com/learn/expert-advice/climbing-helmet.html' },
          { title: 'REI: how to choose and use chalk and chalk bags', url: 'https://www.rei.com/learn/expert-advice/chalk-chalk-bags.html' },
          { title: 'Public Lands: choosing a bouldering crash pad', url: 'https://www.publiclands.com/blog/a/how-to-choose-a-bouldering-crash-pad' },
        ],
      },
    ],
  },
  {
    id: 'knots',
    title: 'Knots',
    summary: 'Animated how-tos for the essential climbing knots.',
    icon: 'knot',
    color: HoldColors.yellow,
    articles: [
      { title: 'Figure-eight follow-through', summary: 'The standard tie-in knot.', url: 'https://www.animatedknots.com/figure-8-follow-through-loop-knot' },
      { title: 'Stopper knot', summary: 'Backing up the tie-in and closing the rope system.', url: 'https://www.animatedknots.com/double-overhand-stopper-knot' },
      { title: 'Clove hitch', summary: 'Adjustable attachment to a carabiner.', url: 'https://www.animatedknots.com/clove-hitch-knot-rope-end' },
      { title: 'Munter hitch', summary: 'Belaying or lowering without a device.', url: 'https://www.animatedknots.com/munter-mule-combination-hitch-knot' },
      { title: 'Prusik', summary: 'Friction hitch for backups and ascending.', url: 'https://www.animatedknots.com/prusik-knot' },
    ],
    credit: { text: 'Animations by Animated Knots by Grog', url: 'https://www.animatedknots.com' },
  },
];

export function getLearnTopic(id: string): LearnTopic | undefined {
  return LEARN_TOPICS.find((topic) => topic.id === id);
}

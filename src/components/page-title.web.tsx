import Head from 'expo-router/head';
import { usePathname } from 'expo-router';

const SITE = 'https://belaybuddy.app';
export const DEFAULT_DESCRIPTION =
  'Find climbing gyms and crags near you, meet partners to climb with, and learn belay safety, gear and knots. Belay Buddy is free.';

/**
 * Sets what the browser tab says, and what people see when a page is shared (title, summary, link
 * and the big preview image), on the website. Pages without their own summary use the site's.
 */
export function PageTitle({ title, description }: { title: string; description?: string }) {
  const path = usePathname();
  const home = path === '/';
  const full = home ? 'Belay Buddy · Find a gym, find a partner, climb safer' : /belay buddy/i.test(title) ? title : `${title} · Belay Buddy`;
  const about = home ? DEFAULT_DESCRIPTION : (description ?? DEFAULT_DESCRIPTION);
  const url = `${SITE}${home ? '' : path}`;
  return (
    <Head>
      <title>{full}</title>
      <meta name="description" content={about} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={about} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE}/og-image.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Belay Buddy: find a gym, find a partner, climb safer." />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={full} />
      <meta name="twitter:description" content={about} />
      <meta name="twitter:image" content={`${SITE}/og-image.png`} />
    </Head>
  );
}

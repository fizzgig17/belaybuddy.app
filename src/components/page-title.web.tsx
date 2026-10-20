import Head from 'expo-router/head';

/** Sets the browser tab title, and the title people see when a page is shared, on the website. */
export function PageTitle({ title }: { title: string }) {
  const full = `${title} · Belay Buddy`;
  return (
    <Head>
      <title>{full}</title>
      <meta property="og:title" content={full} />
    </Head>
  );
}

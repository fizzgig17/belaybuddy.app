import Head from 'expo-router/head';

/** Sets the browser tab title on the website. */
export function PageTitle({ title }: { title: string }) {
  return (
    <Head>
      <title>{`${title} · Belay Buddy`}</title>
    </Head>
  );
}

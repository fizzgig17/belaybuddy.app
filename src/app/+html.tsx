import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The website's HTML shell (static export only). It names the site's icons for every
 * browser: Android Chrome and the home screen want the larger PNGs and the manifest,
 * not just favicon.ico.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0E7A80" />
        <meta property="og:site_name" content="Belay Buddy" />
        <meta property="og:type" content="website" />
        <meta name="google-site-verification" content="pYei1IOza-DQMyjnHfUbjEyt1nUEsqj99XGjovf84CM" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';
import { SiteLinks } from '@/components/site/site-nav';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  ABOUT_FEATURES,
  ABOUT_PRIVACY_NOTE,
  ABOUT_TAGLINE,
  APP_STORE_BADGE,
  APP_STORE_URL,
  PLAY_STORE_BADGE,
  PLAY_STORE_URL,
} from '@/content/about';
import { PLUS_AVAILABILITY, PLUS_FEATURES, PLUS_FREE_NOTE, PLUS_NAME, PLUS_PRICE_NOTE } from '@/content/plus';
import { PRIVACY_CONTACT } from '@/content/privacy';
import { useTheme } from '@/hooks/use-theme';
import type { IconName } from '@/constants/icons';

const ICONS: IconName[] = ['gym', 'holdMap', 'person', 'climber', 'safety', 'climber'];

/** The website's home page: what Belay Buddy is, with a link to the manual. The app itself lives on iPhone and Android. */
export default function Landing() {
  const theme = useTheme();
  return (
    <Screen title="Belay Buddy" showTitle={false} readable>
      <View style={styles.hero}>
        <Image source={require('@/assets/images/icon.png')} accessibilityLabel="" style={styles.logo} />
        <ThemedText type="subtitle" accessibilityRole="header">
          {ABOUT_TAGLINE}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Belay Buddy is a free app for climbers: find gyms and crags, meet partners, log your sessions and brush up on
          safety. It is built for iPhone and Android. This website is an overview and a guide for now.
        </ThemedText>
        <View style={styles.badges}>
          <Link href={APP_STORE_URL as never} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Download on the App Store">
              <Image source={{ uri: APP_STORE_BADGE }} accessibilityLabel="" style={styles.appStore} resizeMode="contain" />
            </Pressable>
          </Link>
          <Link href={PLAY_STORE_URL as never} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Get it on Google Play">
              <Image source={{ uri: PLAY_STORE_BADGE }} accessibilityLabel="" style={styles.play} resizeMode="contain" />
            </Pressable>
          </Link>
        </View>
        <Link href="/manual" asChild>
          <Pressable accessibilityRole="link">
            <View style={[styles.cta, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Read the manual
              </ThemedText>
            </View>
          </Pressable>
        </Link>
      </View>
      <View style={styles.grid}>
        {ABOUT_FEATURES.map((f, i) => (
          <FeatureCard key={f.title} icon={ICONS[i % ICONS.length]} title={f.title} description={f.body} />
        ))}
      </View>
      <View style={styles.plus}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {PLUS_NAME}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{PLUS_FREE_NOTE} Plus adds a few extras:</ThemedText>
        {PLUS_FEATURES.map((f) => (
          <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.body} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          {PLUS_PRICE_NOTE}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {PLUS_AVAILABILITY}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {ABOUT_PRIVACY_NOTE} Climbing is dangerous. Belay Buddy is a helper, not a substitute for proper instruction or your
        own judgment.
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Questions? Email {PRIVACY_CONTACT}.
      </ThemedText>
      <SiteLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.three, alignItems: 'flex-start', paddingTop: Spacing.four },
  // The app icon (teal tile): the plain logo has a white body that disappears on the light page.
  logo: { width: 72, height: 72, borderRadius: 16 },
  cta: { paddingHorizontal: Spacing.four, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  // The Play badge image has built-in margin, so it is drawn larger to look the same size as Apple's.
  appStore: { width: 120, height: 40 },
  play: { width: 155, height: 60, marginLeft: -Spacing.two },
  plus: { gap: Spacing.three },
  grid: { gap: Spacing.three },
});

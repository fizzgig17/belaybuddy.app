import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';
import { SiteLinks } from '@/components/site/site-nav';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ABOUT_FEATURES, ABOUT_PRIVACY_NOTE, ABOUT_TAGLINE } from '@/content/about';
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
        <Image source={require('@/assets/images/belay-buddy-logo.png')} accessibilityLabel="" style={styles.logo} />
        <ThemedText type="subtitle" accessibilityRole="header">
          {ABOUT_TAGLINE}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Belay Buddy is a free app for climbers: find gyms and crags, meet partners, log your sessions and brush up on
          safety. It is built for iPhone and Android. This website is an overview and a guide for now.
        </ThemedText>
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
  logo: { width: 72, height: 72 },
  cta: { paddingHorizontal: Spacing.four, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grid: { gap: Spacing.three },
});

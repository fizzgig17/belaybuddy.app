import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ABOUT_FEATURES, ABOUT_PRIVACY_NOTE, ABOUT_SUMMARY, ABOUT_TAGLINE } from '@/content/about';
import { PRIVACY_CONTACT } from '@/content/privacy';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Public page explaining what Belay Buddy is. */
export default function AboutScreen() {
  const theme = useTheme();
  return (
    <Screen title="About Belay Buddy" showTitle={false}>
      <Stack.Screen options={{ headerShown: true, title: 'About', headerBackTitle: 'Back' }} />
      <ThemedText type="subtitle" accessibilityRole="header">
        About Belay Buddy
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {ABOUT_TAGLINE}
      </ThemedText>
      <ThemedText>{ABOUT_SUMMARY}</ThemedText>
      {ABOUT_FEATURES.map((f) => (
        <View key={f.title} style={styles.section}>
          <ThemedText type="smallBold" accessibilityRole="header">
            {f.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {f.body}
          </ThemedText>
        </View>
      ))}
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Privacy and safety
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {ABOUT_PRIVACY_NOTE}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Climbing is dangerous. Belay Buddy is a helper, not a substitute for proper instruction, checking your partner and your gear, or your own judgment.
        </ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Contact
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Questions or feedback? Email {PRIVACY_CONTACT}.
        </ThemedText>
      </View>
      <View style={styles.links}>
        {[
          ['/privacy', 'Privacy policy'],
          ['/terms', 'Terms of use'],
          ['/delete-account', 'Delete your account'],
        ].map(([href, label]) => (
          <Link key={href} href={href as '/privacy'} asChild>
            <Pressable accessibilityRole="link">
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {label}
              </ThemedText>
            </Pressable>
          </Link>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  links: { gap: Spacing.two },
});

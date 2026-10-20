import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TERMS_INTRO, TERMS_IS_DRAFT, TERMS_SECTIONS, TERMS_UPDATED } from '@/content/terms';

export default function TermsScreen() {
  return (
    <Screen title="Terms of use" description="The rules for using Belay Buddy." showTitle={Platform.OS === 'web'} readable>
      <Stack.Screen options={{ headerShown: Platform.OS !== 'web', title: 'Terms of use', headerBackTitle: 'Back' }} />
      {TERMS_IS_DRAFT && (
        <ThemedText type="smallBold" style={styles.draft}>
          Draft: these terms are being reviewed and may change before release.
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Last updated {TERMS_UPDATED}
      </ThemedText>
      <ThemedText>{TERMS_INTRO}</ThemedText>
      {TERMS_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <ThemedText type="smallBold" accessibilityRole="header">
            {section.title}
          </ThemedText>
          {section.body.map((paragraph) => (
            <ThemedText key={paragraph} type="small" themeColor="textSecondary">
              {paragraph}
            </ThemedText>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  draft: { color: '#B45309' },
});

import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '@/content/privacy';

export default function PrivacyScreen() {
  return (
    <Screen title="Privacy policy" showTitle={Platform.OS === 'web'} readable>
      <Stack.Screen options={{ headerShown: Platform.OS !== 'web', title: 'Privacy policy', headerBackTitle: 'Back' }} />
      <ThemedText type="small" themeColor="textSecondary">
        Last updated {PRIVACY_UPDATED}
      </ThemedText>
      <ThemedText>{PRIVACY_INTRO}</ThemedText>
      {PRIVACY_SECTIONS.map((section) => (
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
});

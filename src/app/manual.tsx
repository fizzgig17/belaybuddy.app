import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SiteLinks } from '@/components/site/site-nav';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { MANUAL_INTRO, MANUAL_SECTIONS } from '@/content/manual';

/** The user manual (belaybuddy.app/manual). */
export default function ManualScreen() {
  return (
    <Screen title="Manual" description="How to use Belay Buddy: find gyms, meet partners, record sessions." showTitle={Platform.OS === 'web'} readable>
      <Stack.Screen options={{ headerShown: Platform.OS !== 'web', title: 'Manual', headerBackTitle: 'Back' }} />
      <ThemedText>{MANUAL_INTRO}</ThemedText>
      {MANUAL_SECTIONS.map((s) => (
        <View key={s.id} style={styles.section} nativeID={s.id}>
          <ThemedText type="smallBold" accessibilityRole="header">
            {s.title}
          </ThemedText>
          {s.intro && (
            <ThemedText type="small" themeColor="textSecondary">
              {s.intro}
            </ThemedText>
          )}
          {s.steps?.map((t, i) => (
            <ThemedText key={i} type="small" themeColor="textSecondary">
              {i + 1}. {t}
            </ThemedText>
          ))}
        </View>
      ))}
      <SiteLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: Spacing.two } });

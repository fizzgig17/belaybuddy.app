import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SessionBody } from '@/app/(tabs)/partners/session';

/**
 * Record a route. Opened by the round button in the middle of the tab bar and slides up over the current tab.
 * Photograph the route's tag and the grade, hold color and name fill in; or pick them by hand. Then tap Sent, Flash
 * or Attempt.
 */
export default function RecordRoute() {
  const theme = useTheme();
  return (
    <Screen title="Record a route" showTitle={false}>
      <View style={styles.header}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
          Record a route
        </ThemedText>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          style={({ pressed }) => [styles.close, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>Done</ThemedText>
        </Pressable>
      </View>
      <SessionBody />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingTop: Spacing.two },
  title: { flexShrink: 1 },
  close: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
});

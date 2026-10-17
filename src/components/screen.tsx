import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Set false for screens pushed onto a stack that already shows a header. */
  showTitle?: boolean;
  /** Shown at the right end of the title row, e.g. a settings button. */
  action?: ReactNode;
};

/** Standard scrollable screen shell used by every tab. */
export function Screen({ title, subtitle, children, showTitle = true, action }: ScreenProps) {
  return (
    <ThemedView style={styles.container}>
      <PageTitle title={title} />
      <SafeAreaView style={styles.safeArea} edges={showTitle ? ['top'] : []}>
        <ScrollView contentContainerStyle={styles.content}>
          {showTitle && (
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
                {title}
              </ThemedText>
              {action}
            </View>
          )}
          {subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.three,
    // The floating tab bar sits above the home indicator and is taller than BottomTabInset,
    // so leave room for it plus some breathing space (the last button was hidden behind it).
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});

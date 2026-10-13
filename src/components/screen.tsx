import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Set false for screens pushed onto a stack that already shows a header. */
  showTitle?: boolean;
};

/** Standard scrollable screen shell used by every tab. */
export function Screen({ title, subtitle, children, showTitle = true }: ScreenProps) {
  return (
    <ThemedView style={styles.container}>
      {/* Browser tab title on the website; ignored in the native app. */}
      <Head>
        <title>{`${title} · Belay Buddy`}</title>
      </Head>
      <SafeAreaView style={styles.safeArea} edges={showTitle ? ['top'] : []}>
        <ScrollView contentContainerStyle={styles.content}>
          {showTitle && (
            <ThemedText type="subtitle" accessibilityRole="header">
              {title}
            </ThemedText>
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
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});

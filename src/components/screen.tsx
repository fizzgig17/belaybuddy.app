import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IS_DEV_BUILD } from '@/components/dev-banner';

import { PageTitle } from '@/components/page-title';
import { KeyboardDoneBar } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton } from '@/components/ui/icon-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Set false for screens pushed onto a stack that already shows a header. */
  showTitle?: boolean;
  /** Shown at the right end of the title row, e.g. a settings button. */
  action?: ReactNode;
  /** Show the person button (opens Profile) at the right end of the title row. Tab screens only. */
  profileButton?: boolean;
  /** Pull down to reload. Give it something that returns when loading is done. */
  onRefresh?: () => Promise<unknown> | void;
  /** Floats above the bottom of the screen, over the tab bar's space (e.g. an Undo bar). */
  overlay?: ReactNode;
};

/** Standard scrollable screen shell used by every tab. */
export function Screen({ title, subtitle, children, showTitle = true, action, profileButton, onRefresh, overlay }: ScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const pull = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;
  return (
    <ThemedView style={styles.container}>
      <PageTitle title={title} />
      <SafeAreaView style={styles.safeArea} edges={showTitle && !IS_DEV_BUILD ? ['top'] : []}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          refreshControl={pull ? <RefreshControl refreshing={refreshing} onRefresh={pull} /> : undefined}>
          {showTitle && (
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
                {title}
              </ThemedText>
              {action}
              {profileButton && (
                <View style={styles.buttons}>
                  <IconButton icon="settings" label="Settings" onPress={() => router.push('/profile/settings')} />
                  <IconButton icon="person" label="Profile" onPress={() => router.push('/profile')} />
                </View>
              )}
            </View>
          )}
          {subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
          {children}
        </ScrollView>
      </SafeAreaView>
      {overlay && <View pointerEvents="box-none" style={styles.overlay}>{overlay}</View>}
      <KeyboardDoneBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  safeArea: { flex: 1 },
  overlay: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: BottomTabInset + Spacing.three },
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

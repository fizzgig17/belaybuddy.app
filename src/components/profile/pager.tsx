import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CompactContext } from '@/components/compact';
import { KeyboardDoneBar } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function closeProfile() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

/**
 * Simple tabs across the top (Profile, Settings, and Admin for admins) with a close button. Tapping a tab switches
 * pages; nothing swipes sideways. Always opens on the first tab.
 */
export function ProfileTabs({ pages }: { pages: { key: string; label: string; content: ReactNode }[] }) {
  const theme = useTheme();
  const [active, setActive] = useState(pages[0].key);
  const current = pages.find((p) => p.key === active) ?? pages[0];
  return (
    <CompactContext.Provider value>
    <View style={styles.fill}>
      <View style={styles.header}>
        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          {pages.map((p) => {
            const on = p.key === current.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setActive(p.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, on && { backgroundColor: theme.surface }]}>
                <ThemedText type="smallBold" style={{ color: on ? theme.accent : theme.textSecondary }}>
                  {p.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {Platform.OS !== 'ios' && (
          <View style={styles.close}>
            <IconButton icon="close" label="Close" onPress={closeProfile} />
          </View>
        )}
      </View>
      <View style={styles.fill}>{current.content}</View>
      <KeyboardDoneBar />
    </View>
    </CompactContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    // On iPhone the sheet's grabber line sits at the very top; keep the tabs clear of it.
    paddingTop: Platform.OS === 'ios' ? Spacing.four : Spacing.two,
    paddingBottom: Spacing.one,
  },
  close: { position: 'absolute', right: Spacing.three, top: Spacing.two },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 3, flexShrink: 1 },
  tab: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
});

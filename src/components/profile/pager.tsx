import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CompactContext } from '@/components/compact';
import { KeyboardDoneBar } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Icons, type IconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TAB_ICONS: Record<string, IconName> = { profile: 'person', settings: 'settings', admin: 'shield' };

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
                <SymbolView name={Icons[TAB_ICONS[p.key] ?? 'person']} size={15} tintColor={on ? theme.accent : theme.textSecondary} />
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
    // Android and web: leave room on the right for the close button so the tabs never sit under it.
    paddingRight: Platform.OS === 'ios' ? Spacing.three : Spacing.three + 48,
    // On iPhone the sheet's grabber line sits at the very top; keep the tabs clear of it.
    paddingTop: Platform.OS === 'ios' ? Spacing.four : Spacing.two,
    paddingBottom: Spacing.one,
  },
  close: { position: 'absolute', right: Spacing.three, top: Spacing.two },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 3, flexShrink: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Platform.OS === 'ios' ? Spacing.three : Spacing.two + 4, paddingVertical: Spacing.two, borderRadius: 999 },
});

import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/page-title';
import { KeyboardDoneBar } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
};

/** Standard scrollable screen shell used by every tab. */
export function Screen({ title, subtitle, children, showTitle = true, action, profileButton }: ScreenProps) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <PageTitle title={title} />
      <SafeAreaView style={styles.safeArea} edges={showTitle ? ['top'] : []}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets>
          {showTitle && (
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
                {title}
              </ThemedText>
              {action}
              {profileButton && (
                <Pressable
                  onPress={() => router.navigate('/profile')}
                  accessibilityRole="button"
                  accessibilityLabel="Profile and settings"
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.profile,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <SymbolView name={Icons.person} size={24} tintColor={theme.accent} />
                </Pressable>
              )}
            </View>
          )}
          {subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
          {children}
        </ScrollView>
      </SafeAreaView>
      <KeyboardDoneBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1 },
  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
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

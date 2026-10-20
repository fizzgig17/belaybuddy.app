import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AboutSheet } from '@/components/about-sheet';
import { IS_DEV_BUILD } from '@/components/dev-banner';

import { PageTitle } from '@/components/page-title';
import { KeyboardDoneBar } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, ReadableWidth, Spacing } from '@/constants/theme';

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
  /** One page inside a pager that already supplies the page title and keyboard bar. */
  embedded?: boolean;
  /** Text pages: a narrower column so lines stay short. */
  readable?: boolean;
};

/** Website pages opened from another page: a way back, since there is no native header. */
function BackPill() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [styles.back, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { opacity: 0.7 }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        ‹ Back
      </ThemedText>
    </Pressable>
  );
}

/** Standard scrollable screen shell used by every tab. */
export function Screen({ title, subtitle, children, showTitle = true, action, profileButton, onRefresh, overlay, embedded, readable }: ScreenProps) {

  const [refreshing, setRefreshing] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const theme = useTheme();
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
      {!embedded && <PageTitle title={title} />}
      <SafeAreaView style={styles.safeArea} edges={showTitle && !IS_DEV_BUILD ? ['top'] : []}>
        <ScrollView contentContainerStyle={[styles.content, readable && { maxWidth: ReadableWidth }]} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          refreshControl={pull ? <RefreshControl refreshing={refreshing} onRefresh={pull} /> : undefined}>
          {showTitle && (
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
                {title}
              </ThemedText>
              {action ?? (Platform.OS === 'web' && !profileButton && !embedded ? <BackPill /> : null)}
              {profileButton && (
                <View style={styles.buttons}>
                  <IconButton icon="about" label="About Belay Buddy" onPress={() => setAboutOpen(true)} />
                  {!user && !authLoading && (
                    <Pressable
                      onPress={() => router.push('/profile')}
                      accessibilityRole="button"
                      accessibilityLabel="Sign in"
                      style={({ pressed }) => [styles.signIn, { backgroundColor: theme.accent }, pressed && { opacity: 0.7 }]}>
                      <ThemedText type="smallBold" style={{ color: theme.background }}>Sign in</ThemedText>
                    </Pressable>
                  )}
                  {user && <IconButton icon="session" label="Start a session" onPress={() => router.push('/partners/session')} />}
                  {user && <IconButton icon="person" label="Profile" onPress={() => router.push('/profile')} />}
                </View>
              )}
            </View>
          )}
          {subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
          {children}
        </ScrollView>
      </SafeAreaView>
      {overlay && <View pointerEvents="box-none" style={styles.overlay}>{overlay}</View>}
      {profileButton && <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />}
      {!embedded && <KeyboardDoneBar />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  back: { height: 40, paddingHorizontal: Spacing.three, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  signIn: { height: 40, paddingHorizontal: Spacing.three, borderRadius: 20, justifyContent: 'center' },
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

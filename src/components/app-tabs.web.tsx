import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { router } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Depth, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs style={styles.root}>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="(find)" href="/" asChild>
            <TabButton>Find</TabButton>
          </TabTrigger>
          <TabTrigger name="partners" href="/partners" asChild>
            <TabButton>Partners</TabButton>
          </TabTrigger>
          <TabTrigger name="route-ai" href="/route-ai" asChild>
            <TabButton>Route AI</TabButton>
          </TabTrigger>
          <TabTrigger name="learn" href="/learn" asChild>
            <TabButton>Learn</TabButton>
          </TabTrigger>
          <TabTrigger name="shops" href="/shops" asChild>
            <TabButton>Shops</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          { backgroundColor: isFocused ? theme.accentSoft : 'transparent' },
        ]}>
        <ThemedText
          type={isFocused ? 'smallBold' : 'small'}
          style={{ color: isFocused ? theme.accent : theme.textSecondary }}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Right end of the nav pill: Sign in for visitors, the Profile button once signed in. */
function AccountButton() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  // Phones: no room in the pill, so the page header carries these (see Screen).
  const { width } = useWindowDimensions();
  if (loading || width < 640) return null;
  if (user) {
    return (
      <View style={styles.account}>
        <IconButton icon="person" label="Profile" onPress={() => router.push('/profile')} />
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel="Sign in"
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered === true;
        return [
          styles.signIn,
          { backgroundColor: theme.accent },
          hovered && ({ filter: 'brightness(1.1)', transform: [{ translateY: -1 }] } as object),
          ({ transitionProperty: 'transform, filter', transitionDuration: '140ms', cursor: 'pointer' } as object),
          state.pressed && { opacity: 0.8 },
        ];
      }}>
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        Sign in
      </ThemedText>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  // Phones don't have room for the name next to five tabs.
  const showBrand = useWindowDimensions().width >= 640;
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView
        type="surface"
        style={[styles.innerContainer, { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, boxShadow: Depth[scheme].card }]}>
        {showBrand && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Belay Buddy
          </ThemedText>
        )}

        {props.children}
        <AccountButton />
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1 },
  tabListContainer: {
    width: '100%',
    padding: Spacing.two,
    paddingTop: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  account: { marginLeft: Spacing.one },
  signIn: { height: 34, paddingHorizontal: Spacing.three, borderRadius: 17, justifyContent: 'center', marginLeft: Spacing.one },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
});

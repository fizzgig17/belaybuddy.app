import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Depth, gradientStyle, MaxContentWidth, Spacing } from '@/constants/theme';
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

/** The site's name, large, on a rope-teal band across the top of every page. */
function Masthead() {
  const wide = useWindowDimensions().width >= 640;
  const dark = useColorScheme() === 'dark';
  const colors = dark ? ['#18797E', '#0F5A5F'] : ['#15939B', '#0E7A80'];
  return (
    <View
      accessibilityRole="header"
      style={[
        styles.masthead,
        { backgroundColor: colors[1], paddingBottom: wide ? 44 : 34, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)' },
        gradientStyle(`linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 100%)`),
      ]}>
      <View style={[styles.mastheadInner, { gap: wide ? 20 : 12 }]}>
        <Image
          source={require('@/assets/images/belay-buddy-logo.png')}
          accessibilityLabel=""
          style={{ width: wide ? 84 : 56, height: wide ? 84 : 56, marginLeft: wide ? -8 : -4 }}
        />
        <View style={{ gap: 4, flexShrink: 1 }}>
          <ThemedText
            style={{ color: '#FFFFFF', fontSize: wide ? 46 : 30, lineHeight: wide ? 48 : 32, fontWeight: 700, letterSpacing: wide ? -1 : -0.6 }}>
            Belay Buddy
          </ThemedText>
          {wide && (
            <ThemedText style={{ color: '#D6ECEC', fontSize: 17, lineHeight: 22 }}>
              Find where to climb, and who to climb with.
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

export function CustomTabList(props: TabListProps) {
  const wide = useWindowDimensions().width >= 640;
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View {...props} style={styles.listRoot}>
      <Masthead />
      <View style={styles.tabListContainer}>
        <ThemedView
          type="surface"
          style={[
            styles.innerContainer,
            wide && styles.innerWide,
            { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, boxShadow: Depth[scheme].raised },
          ]}>
          {props.children}
          {wide && <View style={styles.spacer} />}
          <AccountButton />
        </ThemedView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listRoot: { width: '100%' },
  masthead: { width: '100%', alignItems: 'center', paddingTop: Spacing.four },
  mastheadInner: { width: '100%', maxWidth: MaxContentWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four },
  innerWide: { justifyContent: 'flex-start', paddingLeft: Spacing.four },
  spacer: { flex: 1 },
  root: { flex: 1 },
  slot: { flex: 1 },
  tabListContainer: {
    width: '100%',
    padding: Spacing.two,
    marginTop: -28,
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

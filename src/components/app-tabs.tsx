import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icons, type IconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSessionActive } from '@/lib/active-session';
import { tap } from '@/lib/haptics';

/**
 * The phone's bottom bar: four tabs with a big round Record button in the middle. The middle button is not a tab:
 * it slides the record-a-route sheet up over whatever tab you are on.
 */
export default function AppTabs() {
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <BottomBar>
          <TabTrigger name="(find)" href="/" asChild>
            <NavItem icon="mapTab">Find</NavItem>
          </TabTrigger>
          <TabTrigger name="partners" href="/partners" asChild>
            <NavItem icon="partnersTab">Partners</NavItem>
          </TabTrigger>
          <TabTrigger name="learn" href="/learn" asChild>
            <NavItem icon="learnTab">Learn</NavItem>
          </TabTrigger>
          <TabTrigger name="shops" href="/shops" asChild>
            <NavItem icon="shop">Shops</NavItem>
          </TabTrigger>
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

function NavItem({ children, icon, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.accent : theme.textSecondary;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }} style={styles.item}>
      <SymbolView name={Icons[icon]} size={24} tintColor={color} />
      <ThemedText type={isFocused ? 'smallBold' : 'small'} style={[styles.itemLabel, { color }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

/** The round button, drawn like the Take reading button in hCRI Companion: a see-through ring around a softer filled disc. */
function RecordButton() {
  const theme = useTheme();
  const inSession = useSessionActive();
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push('/record');
      }}
      accessibilityRole="button"
      accessibilityLabel={inSession ? 'End session' : 'Record session'}
      style={({ pressed }) => [styles.recordWrap, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}>
      <View style={[styles.ring, { borderColor: theme.accent + '88', backgroundColor: theme.surface }]}>
        <View style={[styles.disc, { backgroundColor: theme.accent + 'D9' }]}>
          <SymbolView name={Icons.record} size={30} weight="bold" tintColor={theme.onAccent} />
        </View>
      </View>
      <Text style={[styles.recordCaption, { color: theme.accent }]}>{inSession ? 'End session' : 'Record session'}</Text>
    </Pressable>
  );
}

function BottomBar(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const items: ReactNode[] = Children.toArray(props.children);
  return (
    <View
      {...props}
      style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      {items.slice(0, 2)}
      <RecordButton />
      {items.slice(2)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingBottom: 2, minHeight: 48 },
  itemLabel: { fontSize: 11, lineHeight: 14 },
  // The button stands a little above the bar, so it reads as the main action.
  recordWrap: { width: 110, alignItems: 'center', marginTop: -26 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, padding: 4 },
  disc: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  recordCaption: { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
});

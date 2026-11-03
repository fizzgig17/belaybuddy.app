import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Children, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icons, type IconName } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ClimbStrip } from '@/components/record/climb-strip';
import { EndSessionDialog } from '@/components/record/end-session-dialog';
import { RecordSheet } from '@/components/record/record-sheet';
import { useSessionActive } from '@/lib/active-session';
import { useAuth } from '@/lib/auth';
import { confirmEndSession, openRecordSheet, toggleRecordSheet, useRecordSheet } from '@/lib/record-sheet';
import { tap } from '@/lib/haptics';

/**
 * The phone's bottom bar: four tabs with a big round Record button in the middle. The middle button is not a tab:
 * it slides the record-a-route sheet up over whatever tab you are on.
 */
export default function AppTabs() {
  return (
    <Tabs style={styles.root}>
      <View style={styles.slot}>
        <TabSlot style={styles.slot} />
        <ClimbStrip />
        <RecordSheet />
      </View>
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
      <EndSessionDialog />
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

/**
 * The round button, drawn like the Take reading button in hCRI Companion: a see-through ring around a softer filled
 * disc. While a session runs it turns coral and pulses, so it is obvious something is being recorded.
 *   no session:            "Record session"; opens the sheet where you pick the gym and start
 *   session, sheet closed: "Recording"; opens the sheet to log climbs
 *   session, sheet open:   "End session"; ends it (after asking)
 */
function RecordButton() {
  const theme = useTheme();
  const { user } = useAuth();
  const inSession = useSessionActive();
  const { open } = useRecordSheet();
  const color = inSession ? HoldColors.coral : theme.accent;
  const caption = !inSession ? 'Record session' : open ? 'End session' : 'Recording';
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!inSession) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [inSession, pulse]);

  function onPress() {
    tap();
    if (inSession && open) confirmEndSession(user?.id);
    else if (inSession) openRecordSheet();
    else toggleRecordSheet();
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={caption}
      style={({ pressed }) => [styles.recordWrap, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}>
      <Animated.View
        style={[
          styles.ring,
          { borderColor: color + '88', backgroundColor: theme.surface },
          { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] },
        ]}>
        <View style={[styles.disc, { backgroundColor: color + 'D9' }]}>
          <SymbolView name={Icons.climber} size={30} weight="bold" tintColor={theme.onAccent} />
        </View>
      </Animated.View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.recordCaption, { color }]}>
        {caption}
      </Text>
    </Pressable>
  );
}

/** Two tab icons that fade away while the record sheet is open, leaving only the big button. */
function Side({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: hidden ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  }, [hidden, fade]);
  return (
    <Animated.View style={[styles.side, { opacity: fade }]} pointerEvents={hidden ? 'none' : 'auto'}>
      {children}
    </Animated.View>
  );
}

function BottomBar(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const items: ReactNode[] = Children.toArray(props.children);
  const { open } = useRecordSheet();
  return (
    <View
      {...props}
      style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <Side hidden={open}>{items.slice(0, 2)}</Side>
      <RecordButton />
      <Side hidden={open}>{items.slice(2)}</Side>
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
  side: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingBottom: 2, minHeight: 48 },
  itemLabel: { fontSize: 11, lineHeight: 14 },
  // The button stands a little above the bar, so it reads as the main action.
  recordWrap: { width: 124, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, padding: 4 },
  disc: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  recordCaption: { fontSize: 11.5, fontWeight: '700', marginTop: 2, textAlign: 'center', alignSelf: 'stretch' },
});

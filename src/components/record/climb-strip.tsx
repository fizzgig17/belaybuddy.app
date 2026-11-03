import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ClimbBeads } from '@/components/record/climb-beads';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSessionActive, useSessionLogs } from '@/lib/active-session';
import { useRecordSheet } from '@/lib/record-sheet';

// The tip shows once per app launch, after the first climb of a session, and goes away by itself.
let hintShown = false;

/**
 * While a session runs and the record sheet is closed: the climbs so far as beads just above the tab bar, so you
 * see the session at a glance. Tap a bead for details. The first time, a tip says the round button logs the next climb.
 */
export function ClimbStrip() {
  const active = useSessionActive();
  const logs = useSessionLogs();
  const { open } = useRecordSheet();
  const theme = useTheme();
  const [hint, setHint] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      hintShown = true; // you found the button
      setHint(false);
      return;
    }
    if (!active || logs.length === 0 || hintShown) return;
    hintShown = true;
    setHint(true);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setHint(false));
    }, 7000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, logs.length]);

  if (!active || open || logs.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {hint && (
        <Animated.View pointerEvents="none" style={[styles.hint, { opacity: fade, backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Tap the round button to log your next climb
          </ThemedText>
        </Animated.View>
      )}
      <ClimbBeads logs={logs} pill />
    </View>
  );
}

// The round button stands about 26 points above the tab bar; stay clear of it.
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: 34, gap: Spacing.two },
  hint: { alignSelf: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 14 },
});

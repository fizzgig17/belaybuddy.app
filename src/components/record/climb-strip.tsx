import { StyleSheet, View } from 'react-native';

import { ClimbBeads } from '@/components/record/climb-beads';
import { Spacing } from '@/constants/theme';
import { useSessionActive, useSessionLogs } from '@/lib/active-session';
import { useRecordSheet } from '@/lib/record-sheet';

/**
 * While a session runs and the record sheet is closed: the climbs so far as beads just above the tab bar, so you
 * see the session at a glance. Tap a bead for details.
 */
export function ClimbStrip() {
  const active = useSessionActive();
  const logs = useSessionLogs();
  const { open } = useRecordSheet();
  if (!active || open || logs.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <ClimbBeads logs={logs} pill />
    </View>
  );
}

// The round button stands about 26 points above the tab bar; stay clear of it.
const styles = StyleSheet.create({ wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: 34 } });

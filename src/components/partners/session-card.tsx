import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { describeSummary, fetchActiveSession, summarize, type ClimbSession } from '@/lib/climb-log';

/** Entry point to the climb log: continue the open session, or start one. */
export function SessionCard() {
  const [active, setActive] = useState<ClimbSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchActiveSession()
        .then(setActive)
        .catch(() => setActive(null));
    }, []),
  );

  return (
    <Card>
      <View style={styles.text}>
        <ThemedText type="smallBold">{active ? 'Session in progress' : 'Climb log'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {active
            ? `${active.areaName ?? 'Outdoors'} · ${describeSummary(summarize(active.logs))}`
            : 'Log your sends and attempts with one tap while you climb.'}
        </ThemedText>
      </View>
      <View style={styles.buttons}>
        <View style={styles.flex}>
          <Button title={active ? 'Continue' : 'Start session'} onPress={() => router.push('/partners/session')} />
        </View>
        <View style={styles.flex}>
          <Button title="Past sessions" variant="secondary" onPress={() => router.push('/partners/sessions')} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { gap: Spacing.half },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});

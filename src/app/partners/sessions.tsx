import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  deleteSession,
  describeSummary,
  fetchSessions,
  formatDuration,
  hardest,
  summarize,
  type ClimbSession,
} from '@/lib/climb-log';

export default function SessionsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ClimbSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchSessions()
        .then(setSessions)
        .catch((e: Error) => setError(e.message));
    }, [user]),
  );

  async function remove(id: string) {
    const go = async () => {
      try {
        await deleteSession(id);
        setSessions((s) => s?.filter((x) => x.id !== id) ?? null);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete this session?', 'Its climbs are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  }

  const all = sessions ?? [];
  const totals = summarize(all.flatMap((s) => s.logs));

  return (
    <Screen title="Past sessions" showTitle={false}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Your climbing
      </ThemedText>
      {error && <ThemedText type="small" style={{ color: '#C0392B' }}>{error}</ThemedText>}
      {sessions === null && !error && <ActivityIndicator />}
      {sessions && sessions.length === 0 && (
        <ThemedText themeColor="textSecondary">No finished sessions yet. Start one and log a climb.</ThemedText>
      )}
      {sessions && sessions.length > 0 && (
        <View style={styles.totals}>
          <Stat label="Sessions" value={String(all.length)} />
          <Stat label="Sends" value={String(totals.sends + totals.flashes)} />
          <Stat label="Hardest" value={hardest(totals) ?? '–'} />
        </View>
      )}
      {all.map((s) => {
        const sum = summarize(s.logs);
        return (
          <Card key={s.id} style={styles.card}>
            <View style={styles.row}>
              <ThemedText type="smallBold" style={styles.flex} numberOfLines={2}>
                {s.areaName ?? 'Outdoors'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDuration(s.startedAt, s.endedAt)} · {sum.climbs} {sum.climbs === 1 ? 'climb' : 'climbs'}
              {hardest(sum) ? ` · hardest ${hardest(sum)}` : ''}
            </ThemedText>
            <ThemedText type="small">{describeSummary(sum)}</ThemedText>
            <Pressable onPress={() => remove(s.id)} hitSlop={8} accessibilityRole="button" style={styles.delete}>
              <ThemedText type="small" style={{ color: theme.accent }}>Delete</ThemedText>
            </Pressable>
          </Card>
        );
      })}
      <Button title="Start a session" onPress={() => router.replace('/partners/session')} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  totals: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: 0, alignItems: 'center', paddingVertical: Spacing.three },
  card: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'baseline' },
  delete: { alignSelf: 'flex-end', marginTop: Spacing.one },
});

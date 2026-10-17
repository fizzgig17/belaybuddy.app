import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { checkIn, checkOut, fetchMyCheckIn, formatUntil, useFriends, type CheckIn } from '@/lib/friends';

/**
 * "I'm here" for a gym, and which friends are there. Check-ins are opt-in,
 * last 4 hours, and only friends see them.
 */
export function CheckInPanel({ areaId, areaName }: { areaId: string; areaName: string }) {
  const { user } = useAuth();
  const { friends, refresh } = useFriends();
  const [mine, setMine] = useState<CheckIn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refresh();
      fetchMyCheckIn()
        .then(setMine)
        .catch(() => setMine(null));
    }, [user, refresh]),
  );

  if (!user) return null;

  const here = mine?.areaId === areaId;
  const friendsHere = friends.filter((f) => f.checkIn?.areaId === areaId);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (here) {
        await checkOut(user!.id);
        setMine(null);
      } else {
        setMine(await checkIn(areaId, areaName, 4));
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.text}>
        <ThemedText type="smallBold">{here ? `You’re checked in until ${formatUntil(mine!.until)}` : 'Let friends know you’re here'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {friendsHere.length > 0
            ? `Friends here now: ${friendsHere.map((f) => f.name).join(', ')}`
            : friends.length === 0
              ? 'Only your friends can see a check-in, and it ends after 4 hours.'
              : 'None of your friends are checked in here right now.'}
        </ThemedText>
      </View>
      <Button title={here ? 'Check out' : 'Check in for 4 hours'} variant={here ? 'secondary' : 'primary'} onPress={toggle} loading={busy} />
      {friends.length === 0 && (
        <Button title="Add friends" variant="secondary" onPress={() => router.push('/partners/friends')} />
      )}
      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: Spacing.half },
  error: { color: '#C0392B' },
});

import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card, Section } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteMyAccount, fetchBlocked, unblockClimber, type BlockedClimber } from '@/lib/partners';

/** Blocked climbers and account deletion (both required for the App Store). */
export function PrivacySettings() {
  const theme = useTheme();
  const [blocked, setBlocked] = useState<BlockedClimber[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBlocked()
      .then(setBlocked)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function unblock(userId: string) {
    try {
      await unblockClimber(userId);
      setBlocked((list) => list.filter((b) => b.userId !== userId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteMyAccount();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  function confirmDelete() {
    const title = 'Delete your account?';
    const message =
      'This permanently deletes your profile, favorites, home gyms, posts and chats. It can’t be undone.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n\n${message}`)) remove();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: remove },
    ]);
  }

  return (
    <Section title="Privacy & safety">
      <Card style={styles.card}>
        <ThemedText type="smallBold">Blocked climbers</ThemedText>
        {blocked.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nobody. Block someone from their profile and you won't see each other anywhere in Belay Buddy.
          </ThemedText>
        ) : (
          blocked.map((b) => (
            <View key={b.userId} style={styles.row}>
              <ThemedText type="small" style={styles.flex}>
                {b.name || 'A climber'}
              </ThemedText>
              <Button title="Unblock" variant="secondary" onPress={() => unblock(b.userId)} />
            </View>
          ))
        )}
      </Card>
      <ThemedText type="small" themeColor="textSecondary">
        Partners only ever see the gym and time you post, never your location. Your weight, if you added it, is
        never shown to anyone.
      </ThemedText>
      <Button title="Delete account" variant="secondary" onPress={confirmDelete} loading={deleting} />
      {error && (
        <ThemedText type="small" style={{ color: theme.accent }}>
          {error}
        </ThemedText>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});

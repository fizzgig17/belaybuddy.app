import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import { addFriendByCode, savePendingCode } from '@/lib/friends';

/**
 * Where a friend link lands (belaybuddy.app/friend/ABCD2345). Signed in, it
 * sends the request; signed out, it remembers the code until you sign in.
 */
export default function FriendLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !code) return;
    if (!user) {
      savePendingCode(String(code));
      return;
    }
    let active = true;
    setBusy(true);
    addFriendByCode(String(code))
      .then((r) => {
        if (!active) return;
        setMessage(
          r.status === 'accepted'
            ? `You and ${r.name} are now friends.`
            : r.status === 'already'
              ? `You and ${r.name} are already friends.`
              : r.status === 'invalid'
                ? 'That friend link did not work. Ask them for a new one.'
                : `Request sent to ${r.name}. They need to accept it.`,
        );
      })
      .catch((e: Error) => active && setMessage(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [user, loading, code]);

  return (
    <Screen title="Add a friend" showTitle={false}>
      <ThemedText type="subtitle" accessibilityRole="header">Add a friend</ThemedText>
      {loading || busy ? (
        <ActivityIndicator />
      ) : !user ? (
        <>
          <ThemedText>Sign in or create an account to add this friend. We will send the request as soon as you are in.</ThemedText>
          <Button title="Sign in" onPress={() => router.push('/profile')} />
        </>
      ) : (
        <>
          {message && <ThemedText>{message}</ThemedText>}
          <Button title="Go to friends" onPress={() => router.replace('/partners/friends')} />
        </>
      )}
    </Screen>
  );
}

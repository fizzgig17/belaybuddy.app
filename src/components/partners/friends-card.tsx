import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { formatUntil, useFriends } from '@/lib/friends';

/** Entry point to friends on the Partners tab: requests, and who is at a gym now. */
export function FriendsCard() {
  const { friends, incoming, refresh } = useFriends();
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const here = friends.filter((f) => f.checkIn);

  return (
    <Card>
      <View style={styles.text}>
        <ThemedText type="smallBold">Friends</ThemedText>
        {here.length > 0 ? (
          here.slice(0, 3).map((f) => (
            <ThemedText key={f.friendshipId} type="small" themeColor="textSecondary">
              {f.name} is at {f.checkIn!.areaName} until {formatUntil(f.checkIn!.until)}
            </ThemedText>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {friends.length === 0
              ? 'Add friends to see when they check in at the gym.'
              : 'None of your friends are checked in right now.'}
          </ThemedText>
        )}
      </View>
      <Button
        title={incoming.length > 0 ? `Friends (${incoming.length} request${incoming.length === 1 ? '' : 's'})` : 'Friends'}
        variant="secondary"
        onPress={() => router.push('/partners/friends')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: Spacing.half },
});

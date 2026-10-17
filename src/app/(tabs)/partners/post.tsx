import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ClimberSummary } from '@/components/partners/climber-summary';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { enablePush, getPushStatus } from '@/lib/notifications';
import {
  deletePost,
  fetchCards,
  fetchPost,
  fetchResponders,
  formatGrades,
  formatWindow,
  GOAL_LABELS,
  joinPost,
  leavePost,
  POST_STYLE_LABELS,
} from '@/lib/partners';
import type { BelayPost, ClimberCard } from '@/types/models';

function confirm(title: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(title)) onConfirm();
    return;
  }
  Alert.alert(title, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function PostScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<BelayPost | null | undefined>(undefined);
  const [responders, setResponders] = useState<string[]>([]);
  const [cards, setCards] = useState<Map<string, ClimberCard>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !user) return;
    try {
      const p = await fetchPost(id);
      const rs = p ? (await fetchResponders([p.id])).map((r) => r.userId) : [];
      const people = p ? await fetchCards([p.userId, ...rs]) : new Map();
      setPost(p);
      setResponders(rs);
      setCards(people);
    } catch (e) {
      setError((e as Error).message);
      setPost(null);
    }
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) {
    return (
      <Screen title="Session" showTitle={false}>
        <ThemedText>Sign in to see the belay boards.</ThemedText>
        <Button title="Sign in" onPress={() => router.push('/profile')} />
      </Screen>
    );
  }
  if (post === undefined) {
    return (
      <Screen title="Session" showTitle={false}>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    );
  }
  if (!post) {
    return (
      <Screen title="Session" showTitle={false}>
        <ThemedText>{error ?? 'This session has ended or was removed.'}</ThemedText>
      </Screen>
    );
  }

  const mine = post.userId === user.id;
  const joined = responders.includes(user.id);
  const poster = cards.get(post.userId);
  const grades = formatGrades(post);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const openChat = (responderId: string) =>
    router.push({ pathname: '/partners/chat', params: { post: post.id, with: responderId } });

  return (
    <Screen title={`${GOAL_LABELS[post.goal]} at ${post.areaName}`} showTitle={false}>
      <View style={styles.heading}>
        <ThemedText type="subtitle">{formatWindow(post)}</ThemedText>
        <ThemedText themeColor="textSecondary">{post.areaName}</ThemedText>
      </View>

      <Card style={styles.card}>
        <Row label="Goal" value={GOAL_LABELS[post.goal]} />
        {post.styles.length > 0 && <Row label="Climbing" value={post.styles.map((s) => POST_STYLE_LABELS[s]).join(', ')} />}
        {grades && <Row label="Grades" value={grades} />}
        {post.mentoring && <Row label="Mentoring" value="Happy to climb with someone newer" />}
        {post.note && <Row label="Note" value={post.note} />}
      </Card>

      {mine ? (
        <>
          <ThemedText type="smallBold">
            {responders.length === 0
              ? 'Nobody has joined yet'
              : `${responders.length} ${responders.length === 1 ? 'climber is' : 'climbers are'} in`}
          </ThemedText>
          {responders.map((r) => {
            const card = cards.get(r);
            return card ? (
              <ClimberSummary
                key={r}
                card={card}
                postId={post.id}
                trailing={<Button title={`Chat with ${card.displayName || 'them'}`} onPress={() => openChat(r)} />}
              />
            ) : null;
          })}
          <Button
            title="Remove this post"
            variant="secondary"
            loading={busy}
            onPress={() =>
              confirm('Remove this post?', 'Remove', () =>
                run(async () => {
                  await deletePost(post.id);
                  router.back();
                }),
              )
            }
          />
        </>
      ) : (
        <>
          {poster && <ClimberSummary card={poster} postId={post.id} />}
          {joined ? (
            <>
              <Button title="Open chat" onPress={() => openChat(user.id)} />
              <Button
                title="I can't make it"
                variant="secondary"
                loading={busy}
                onPress={() => run(() => leavePost(post.id, user.id))}
              />
            </>
          ) : (
            <Button
              title="I'm in"
              loading={busy}
              onPress={() =>
                run(async () => {
                  await joinPost(post.id);
                  // So they hear back: ask for notifications (iOS asks once).
                  if ((await getPushStatus()) === 'off') await enablePush().catch(() => {});
                })
              }
            />
          )}
          <ThemedText type="small" themeColor="textSecondary">
            “I'm in” lets {poster?.displayName || 'them'} know and opens a chat for this session. The chat closes
            two hours after the session ends.
          </ThemedText>
        </>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.accent }}>
          {error}
        </ThemedText>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: Spacing.five },
  heading: { gap: Spacing.one },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  row: { gap: Spacing.half },
});

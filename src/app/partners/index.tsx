import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Button, SingleChoice } from '@/components/form';
import { GymWallBanner } from '@/components/illustrations';
import { PostCard } from '@/components/partners/post-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { areaSlug, slugToId } from '@/lib/areas';
import { useAuth } from '@/lib/auth';
import { useHomeGyms } from '@/lib/home-gyms';
import { fetchBoard, fetchCards, fetchJoinedPosts, fetchMyPosts, fetchResponders } from '@/lib/partners';
import type { BelayPost, ClimberCard } from '@/types/models';

type Gym = { areaId: string; name: string };

export default function PartnersScreen() {
  const { user, loading: authLoading } = useAuth();
  const { homeGyms, loading: gymsLoading } = useHomeGyms();
  // /partners?gym=osm-way-123&name=… opens another gym's board (e.g. when traveling).
  const params = useLocalSearchParams<{ gym?: string; name?: string }>();
  const visiting = useMemo<Gym | null>(() => {
    const id = params.gym ? slugToId(params.gym) : null;
    return id ? { areaId: id, name: params.name ?? 'This gym' } : null;
  }, [params.gym, params.name]);

  const gyms = useMemo<Gym[]>(() => {
    const list: Gym[] = homeGyms.map((g) => ({ areaId: g.areaId, name: g.name }));
    if (visiting && !list.some((g) => g.areaId === visiting.areaId)) list.push(visiting);
    return list;
  }, [homeGyms, visiting]);

  const [selected, setSelected] = useState<string | null>(null);
  const gym = gyms.find((g) => g.areaId === (selected ?? visiting?.areaId)) ?? gyms[0];

  const [board, setBoard] = useState<BelayPost[] | null>(null);
  const [mine, setMine] = useState<BelayPost[]>([]);
  const [joined, setJoined] = useState<BelayPost[]>([]);
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map());
  const [cards, setCards] = useState<Map<string, ClimberCard>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const gymId = gym?.areaId;
  const userId = user?.id;

  // Reload whenever the screen comes back into view (after posting, joining…).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      setError(null);
      (async () => {
        try {
          const [boardPosts, myPosts, joinedPosts] = await Promise.all([
            gymId ? fetchBoard(gymId) : Promise.resolve([]),
            fetchMyPosts(userId),
            fetchJoinedPosts(userId),
          ]);
          const responses = await fetchResponders(myPosts.map((p) => p.id));
          const people = await fetchCards([...boardPosts, ...joinedPosts].map((p) => p.userId));
          if (!active) return;
          const counts = new Map<string, number>();
          for (const r of responses) counts.set(r.postId, (counts.get(r.postId) ?? 0) + 1);
          setBoard(boardPosts.filter((p) => p.userId === userId || people.has(p.userId)));
          setMine(myPosts);
          setJoined(joinedPosts);
          setResponseCounts(counts);
          setCards(people);
        } catch (e) {
          if (active) setError((e as Error).message);
        }
      })();
      return () => {
        active = false;
      };
    }, [userId, gymId]),
  );

  if (authLoading) {
    return (
      <Screen title="Partners">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen title="Partners" subtitle="Find someone to climb with at your gym, or wherever you're headed.">
        <GymWallBanner />
        <ThemedText>
          Each gym has a belay board: post when you'll be there and what you want to climb, and see who else is
          coming. Only signed-in climbers can see the boards, and only the gym and time are shown, never your
          location.
        </ThemedText>
        <Button title="Sign in to see the boards" onPress={() => router.push('/profile')} />
      </Screen>
    );
  }

  // Sessions at the gym on screen already show on its board.
  const otherSessions = [...mine, ...joined]
    .filter((p) => p.areaId !== gym?.areaId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const badgeFor = (post: BelayPost) => {
    if (post.userId !== user.id) return joined.some((j) => j.id === post.id) ? "You're in" : undefined;
    const count = responseCounts.get(post.id) ?? 0;
    return count ? `${count} in` : 'Yours';
  };

  return (
    <Screen title="Partners" subtitle="Who's climbing at your gym, and when.">
      {gyms.length === 0 ? (
        gymsLoading ? (
          <ActivityIndicator />
        ) : (
          <>
            <GymWallBanner />
            <FeatureCard
              icon="home"
              title="Pick your home gym"
              description="Open a gym in Find and tap “Home gym”. Its belay board shows up here. Add more than one if you climb at several."
              href="/"
            />
          </>
        )
      ) : (
        <>
          {gyms.length > 1 && (
            <SingleChoice
              label="Gym"
              value={gym!.areaId}
              onChange={setSelected}
              options={gyms.map((g) => ({ value: g.areaId, label: g.name }))}
            />
          )}

          <View style={styles.boardHeader}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{gym!.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Belay board
                {visiting && visiting.areaId === gym!.areaId && !homeGyms.some((g) => g.areaId === gym!.areaId)
                  ? ' (visiting)'
                  : ''}
              </ThemedText>
            </View>
            <Button
              title="Post"
              onPress={() =>
                router.push({ pathname: '/partners/new', params: { gym: areaSlug(gym!.areaId), name: gym!.name } })
              }
            />
          </View>

          {error && (
            <ThemedView type="backgroundElement" style={styles.notice}>
              <ThemedText type="small">Couldn't load the board: {error}</ThemedText>
            </ThemedView>
          )}

          {board === null && !error ? (
            <ActivityIndicator style={styles.loading} />
          ) : board && board.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Nobody's posted yet. Post when you'll be there and what you want to climb, and others at this gym
              will see it.
            </ThemedText>
          ) : (
            board?.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                card={cards.get(post.userId)}
                badge={badgeFor(post)}
              />
            ))
          )}
        </>
      )}

      {otherSessions.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Your sessions at other gyms</ThemedText>
          {otherSessions.map((post) => (
            <PostCard key={post.id} post={post} card={cards.get(post.userId)} showGym badge={badgeFor(post)} />
          ))}
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Meet at the front desk, do a partner check every time, and trust your gut. You can block or report anyone
        from their profile.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  boardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  section: { gap: Spacing.two },
  loading: { marginVertical: Spacing.four },
  notice: { padding: Spacing.three, borderRadius: Spacing.three },
});

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Button, ButtonIcon, SingleChoice } from '@/components/form';
import { GymWallBanner } from '@/components/illustrations';
import { PostCard } from '@/components/partners/post-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { areaSlug, slugToId } from '@/lib/areas';
import { useLiveRefresh } from '@/lib/live';
import { useAuth } from '@/lib/auth';
import { FriendsCard } from '@/components/partners/friends-card';
import { SessionCard } from '@/components/partners/session-card';
import { useHomeGyms } from '@/lib/home-gyms';
import { fetchBoard, fetchCards, fetchJoinedPosts, fetchMyPosts, fetchResponders } from '@/lib/partners';
import type { BelayPost, ClimberCard, ClimbingArea } from '@/types/models';

type Gym = { areaId: string; name: string; latitude?: number; longitude?: number };
const ALL = 'all';

export default function PartnersScreen() {
  const { user, loading: authLoading } = useAuth();
  const homeGyms = useHomeGyms();
  // /partners?gym=osm-way-123&name=…&lat=…&lng=… opens one gym's board, e.g.
  // from a gym's page in Find when you're traveling.
  const params = useLocalSearchParams<{ gym?: string; name?: string; lat?: string; lng?: string }>();
  const opened = useMemo<Gym | null>(() => {
    const id = params.gym ? slugToId(params.gym) : null;
    if (!id) return null;
    return {
      areaId: id,
      name: params.name ?? 'This gym',
      latitude: params.lat ? Number(params.lat) : undefined,
      longitude: params.lng ? Number(params.lng) : undefined,
    };
  }, [params.gym, params.name, params.lat, params.lng]);

  const home: Gym[] = homeGyms.homeGyms.map((g) => ({ areaId: g.areaId, name: g.name }));
  const otherGym = opened && !homeGyms.isHomeGym(opened.areaId) ? opened : null;

  // Which board is showing: every home gym together, or one gym.
  const [picked, setPicked] = useState<string | null>(null);
  const defaultView = opened ? opened.areaId : home.length > 1 ? ALL : home[0]?.areaId;
  const view = picked && (picked === ALL || picked === otherGym?.areaId || homeGyms.isHomeGym(picked)) ? picked : defaultView;
  const shownIds = useMemo(
    () => (view === ALL ? home.map((g) => g.areaId) : view ? [view] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, homeGyms.homeGyms],
  );
  const singleGym = view && view !== ALL ? (home.find((g) => g.areaId === view) ?? otherGym) : null;

  const [board, setBoard] = useState<BelayPost[] | null>(null);
  const [mine, setMine] = useState<BelayPost[]>([]);
  const [joined, setJoined] = useState<BelayPost[]>([]);
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map());
  const [cards, setCards] = useState<Map<string, ClimberCard>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;
  const idsKey = shownIds.join(',');

  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [boardPosts, myPosts, joinedPosts] = await Promise.all([
        fetchBoard(idsKey ? idsKey.split(',') : []),
        fetchMyPosts(userId),
        fetchJoinedPosts(userId),
      ]);
      const responses = await fetchResponders(myPosts.map((p) => p.id));
      const people = await fetchCards([...boardPosts, ...joinedPosts].map((p) => p.userId));
      if (!alive.current) return;
      const counts = new Map<string, number>();
      for (const r of responses) counts.set(r.postId, (counts.get(r.postId) ?? 0) + 1);
      setBoard(boardPosts.filter((p) => p.userId === userId || people.has(p.userId)));
      setMine(myPosts);
      setJoined(joinedPosts);
      setResponseCounts(counts);
      setCards(people);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [userId, idsKey]);

  // Reload whenever the screen comes back into view (after posting, joining…);
  // pulling the screen down reloads too.
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      load();
      return () => {
        alive.current = false;
      };
    }, [load]),
  );

  useLiveRefresh(['belay_posts', 'post_responses'], load, Boolean(userId));

  if (authLoading) {
    return (
      <Screen profileButton title="Partners">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen profileButton title="Partners" subtitle="Find someone to climb with at your gym, or wherever you're headed.">
        <GymWallBanner />
        <ThemedText>
          Each gym has a belay board: post when you'll be there and what you want to climb, and see who else is
          coming. Only signed-in climbers can see the boards, and only the gym and time are shown, never your
          location.
        </ThemedText>
        <Button title="Sign in to see the boards" icon={<ButtonIcon name="person" />} onPress={() => router.push('/profile')} />
      </Screen>
    );
  }

  const showing = new Set(shownIds);
  const otherSessions = [...mine, ...joined]
    .filter((p) => !showing.has(p.areaId))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const badgeFor = (post: BelayPost) => {
    if (post.userId !== user.id) return joined.some((j) => j.id === post.id) ? "You're in" : undefined;
    const count = responseCounts.get(post.id) ?? 0;
    return count ? `${count} in` : 'Yours';
  };

  const choices = [
    ...(home.length > 1 ? [{ value: ALL, label: 'All my gyms' }] : []),
    ...home.map((g) => ({ value: g.areaId, label: g.name })),
    ...(otherGym ? [{ value: otherGym.areaId, label: otherGym.name }] : []),
  ];

  function addOtherAsHome() {
    if (!otherGym || otherGym.latitude == null || otherGym.longitude == null) return;
    const area: ClimbingArea = {
      id: otherGym.areaId,
      kind: 'gym',
      name: otherGym.name,
      location: { latitude: otherGym.latitude, longitude: otherGym.longitude },
      styles: [],
      source: 'osm',
    };
    homeGyms.toggle(area);
  }

  const newPost = () =>
    router.push({
      pathname: '/partners/new',
      params: singleGym ? { gym: areaSlug(singleGym.areaId), name: singleGym.name } : {},
    });

  return (
    <Screen profileButton title="Partners" subtitle="Who's climbing at your gyms, and when." onRefresh={load}>
      <SessionCard />
      {user && <FriendsCard />}
      {home.length === 0 && !otherGym ? (
        homeGyms.loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <GymWallBanner />
            <FeatureCard
              icon="home"
              title="Pick your home gym"
              description="Open a gym in Find and tap “Set as home gym”. Its belay board shows up here. Add more than one if you climb at several."
              href="/"
            />
          </>
        )
      ) : (
        <>
          {choices.length > 1 && <SingleChoice label="Board" value={view!} onChange={setPicked} options={choices} />}

          {otherGym && view === otherGym.areaId && (
            <ThemedView type="backgroundElement" style={styles.notice}>
              <ThemedText type="small">
                {otherGym.name} isn't one of your home gyms. You can still post and join sessions here, which is
                handy when you're traveling.
              </ThemedText>
              {otherGym.latitude != null && (
                <Button title="Make it a home gym" variant="secondary" onPress={addOtherAsHome} />
              )}
            </ThemedView>
          )}

          <View style={styles.boardHeader}>
            <ThemedText type="smallBold" style={styles.flex}>
              {singleGym ? `${singleGym.name} belay board` : 'Belay boards at your gyms'}
            </ThemedText>
            <Button title="Post" onPress={newPost} />
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
              Nobody's posted yet. Post when you'll be there and what you want to climb, and other climbers at{' '}
              {singleGym ? 'this gym' : 'your gyms'} will see it.
            </ThemedText>
          ) : (
            board?.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                card={cards.get(post.userId)}
                showGym={!singleGym}
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
  notice: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});

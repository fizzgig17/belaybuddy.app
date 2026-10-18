import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { select, success, tap } from '@/lib/haptics';
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

  // Selecting several: long-press a session (or tap "Select"), tap to add or remove.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const swipers = useRef(new Map<string, SwipeableMethods>());
  const fullSwipe = useRef<string | null>(null);

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (id: string) => {
    select();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const startSelecting = (id?: string) => {
    tap();
    setSelecting(true);
    setSelected(new Set(id ? [id] : []));
  };

  async function deleteMany(ids: string[], quiet = false) {
    const results = await Promise.allSettled(ids.map((id) => deleteSession(id)));
    const gone = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setSessions((s) => s?.filter((x) => !gone.has(x.id)) ?? null);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) setError((failed.reason as Error).message);
    else if (!quiet) success();
    stopSelecting();
  }

  function confirmDelete(ids: string[], onCancel?: () => void) {
    if (ids.length === 0) return;
    const title = ids.length === 1 ? 'Delete this session?' : `Delete ${ids.length} sessions?`;
    const detail = ids.length === 1 ? 'Its climbs are deleted too.' : 'Their climbs are deleted too.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title} ${detail}`) ?? true) void deleteMany(ids);
      else onCancel?.();
      return;
    }
    Alert.alert(title, detail, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteMany(ids) },
    ]);
  }

  // Swipe-to-delete is instant, like Gmail: the row goes away at once and an
  // "Undo" bar stays for a few seconds before the delete is really sent.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undoFor, setUndoFor] = useState<string[] | null>(null);
  const pending = useRef<{ ids: string[]; timer: ReturnType<typeof setTimeout> } | null>(null);

  const flushPending = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setUndoFor(null);
    void deleteMany(p.ids, true).finally(() => setHidden((h) => new Set([...h].filter((id) => !p.ids.includes(id)))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function deleteWithUndo(ids: string[]) {
    flushPending(); // a new delete settles the previous one
    setHidden((h) => new Set([...h, ...ids]));
    setUndoFor(ids);
    pending.current = { ids, timer: setTimeout(flushPending, 5000) };
  }
  function undoDelete() {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setUndoFor(null);
    setHidden((h) => new Set([...h].filter((id) => !p.ids.includes(id))));
  }
  // Leaving the screen makes the delete final.
  useFocusEffect(useCallback(() => flushPending, [flushPending]));

  const all = (sessions ?? []).filter((x) => !hidden.has(x.id));
  const totals = summarize(all.flatMap((s) => s.logs));
  const allSelected = all.length > 0 && selected.size === all.length;

  return (
    <Screen title="Past sessions" showTitle={false} overlay={undoFor ? <UndoBar count={undoFor.length} onUndo={undoDelete} /> : undefined} onRefresh={() => fetchSessions().then(setSessions).catch((e: Error) => setError(e.message))}>
      <View style={styles.headerRow}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.flex}>
          Your climbing
        </ThemedText>
        {!selecting && all.length > 0 && (
          <Pressable onPress={() => startSelecting()} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>Select</ThemedText>
          </Pressable>
        )}
      </View>
      {selecting && (
        <View style={styles.toolbar}>
          <Pressable onPress={stopSelecting} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={[styles.flex, styles.center]}>
            {selected.size} selected
          </ThemedText>
          <Pressable
            onPress={() => {
              select();
              setSelected(allSelected ? new Set() : new Set(all.map((x) => x.id)));
            }}
            hitSlop={8}
            accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {allSelected ? 'Select none' : 'Select all'}
            </ThemedText>
          </Pressable>
        </View>
      )}
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
        const checked = selected.has(s.id);
        const card = (
          <Pressable
            onPress={selecting ? () => toggle(s.id) : undefined}
            onLongPress={selecting ? undefined : () => startSelecting(s.id)}
            delayLongPress={350}
            accessibilityRole={selecting ? 'checkbox' : 'button'}
            accessibilityState={selecting ? { checked } : undefined}
            accessibilityHint={selecting ? undefined : 'Press and hold to select sessions to delete'}>
            <Card style={[styles.card, checked && { borderColor: theme.accent }]}>
              <View style={styles.row}>
                {selecting && (
                  <View
                    style={[
                      styles.check,
                      { borderColor: checked ? theme.accent : theme.border, backgroundColor: checked ? theme.accent : 'transparent' },
                    ]}>
                    {checked && <ThemedText type="smallBold" style={styles.checkMark}>✓</ThemedText>}
                  </View>
                )}
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
              {!selecting && Platform.OS === 'web' && (
                <Pressable onPress={() => deleteWithUndo([s.id])} hitSlop={8} accessibilityRole="button" style={styles.delete}>
                  <ThemedText type="small" style={{ color: theme.accent }}>Delete</ThemedText>
                </Pressable>
              )}
            </Card>
          </Pressable>
        );
        // On the phone, swipe a session left to reveal Delete.
        if (Platform.OS === 'web' || selecting) return <View key={s.id}>{card}</View>;
        return (
          <ReanimatedSwipeable
            key={s.id}
            ref={(r) => {
              if (r) swipers.current.set(s.id, r);
              else swipers.current.delete(s.id);
            }}
            friction={1}
            rightThreshold={40}
            overshootRight
            onSwipeableWillOpen={() => {
              // Let go past the full-swipe line: delete right away, no questions.
              if (fullSwipe.current === s.id) {
                fullSwipe.current = null;
                deleteWithUndo([s.id]);
              }
            }}
            renderRightActions={(_progress, drag) => (
              <DeleteAction
                drag={drag}
                onFullChange={(full) => {
                  fullSwipe.current = full ? s.id : fullSwipe.current === s.id ? null : fullSwipe.current;
                  tap(); // one tick as the full Delete appears, one as it goes away again
                }}
                onPress={() => deleteWithUndo([s.id])}
              />
            )}>
            {card}
          </ReanimatedSwipeable>
        );
      })}
      {selecting && (
        <Button
          title={selected.size ? `Delete ${selected.size} ${selected.size === 1 ? 'session' : 'sessions'}` : 'Delete'}
          disabled={selected.size === 0}
          onPress={() => confirmDelete([...selected])}
        />
      )}
      {!selecting && <Button title="Start a session" onPress={() => router.replace('/partners/session')} />}
    </Screen>
  );
}

const ACTION_WIDTH = 92;
/** How far the row must be dragged before letting go deletes it. */
const FULL_SWIPE = 220;

/**
 * The red Delete button behind a swiped session. It shows at the normal width
 * and grows as you keep dragging; past FULL_SWIPE, letting go deletes.
 */
function DeleteAction({
  drag,
  onPress,
  onFullChange,
}: {
  drag: SharedValue<number>;
  onPress: () => void;
  onFullChange: (full: boolean) => void;
}) {
  useAnimatedReaction(
    () => drag.value <= -FULL_SWIPE,
    (full, previous) => {
      if (full !== previous) runOnJS(onFullChange)(full);
    },
  );
  const grow = useAnimatedStyle(() => ({ width: Math.max(ACTION_WIDTH, -drag.value) }));
  return (
    <View style={styles.swipeSlot}>
      <Animated.View style={[styles.swipeDelete, grow]}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Delete session" style={styles.swipePress}>
          <ThemedText type="smallBold" style={styles.swipeDeleteText}>Delete</ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function UndoBar({ count, onUndo }: { count: number; onUndo: () => void }) {
  return (
    <View style={styles.undoBar} accessibilityLiveRegion="polite">
      <ThemedText type="small" style={styles.undoText}>
        {count === 1 ? 'Session deleted' : `${count} sessions deleted`}
      </ThemedText>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button">
        <ThemedText type="smallBold" style={styles.undoAction}>Undo</ThemedText>
      </Pressable>
    </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  checkMark: { color: '#FFFFFF', fontSize: 13, lineHeight: 16 },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2D35',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  undoText: { color: '#FFFFFF' },
  undoAction: { color: '#7FD6D9' },
  swipeSlot: { width: ACTION_WIDTH + Spacing.two },
  swipeDelete: {
    backgroundColor: '#C0392B',
    height: '100%',
    marginLeft: Spacing.two,
    borderRadius: 16,
  },
  swipePress: { flex: 1, justifyContent: 'center', alignItems: 'center', minWidth: ACTION_WIDTH },
  swipeDeleteText: { color: '#FFFFFF' },
});

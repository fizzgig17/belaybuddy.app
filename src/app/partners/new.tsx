import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, Field, SingleChoice, ToggleRow } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { slugToId } from '@/lib/areas';
import { useAuth } from '@/lib/auth';
import { createPost, formatWindow, GOAL_LABELS, POST_STYLE_LABELS } from '@/lib/partners';
import type { BelayPost, SessionGoal } from '@/types/models';

type When = 'now' | number; // 'now' or days from today (0 = later today)

const DURATIONS = [1, 2, 3, 4] as const;
const FIRST_HOUR = 6;
const LAST_HOUR = 22;

/** Styles that usually go with a session goal, as a starting point. */
const GOAL_STYLES: Record<SessionGoal, BelayPost['styles']> = {
  projecting: ['lead'],
  mileage: ['top-rope'],
  'learning-lead': ['lead'],
  'top-rope-laps': ['top-rope'],
  bouldering: ['bouldering'],
};

const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

export default function NewPostScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ gym?: string; name?: string }>();
  const areaId = params.gym ? slugToId(params.gym) : null;
  const areaName = params.name ?? 'Gym';

  const [when, setWhen] = useState<When>('now');
  const [hour, setHour] = useState<number | null>(null);
  const [hours, setHours] = useState<(typeof DURATIONS)[number]>(2);
  const [goal, setGoal] = useState<SessionGoal>('mileage');
  const [styles_, setStyles] = useState<BelayPost['styles']>(GOAL_STYLES.mileage);
  const [gradeLow, setGradeLow] = useState('');
  const [gradeHigh, setGradeHigh] = useState('');
  const [mentoring, setMentoring] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const dayOptions = useMemo(() => {
    const opts: { value: When; label: string }[] = [{ value: 'now', label: "I'm here now" }];
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      // Skip "later today" once it's too late to start a session.
      if (d === 0 && date.getHours() >= LAST_HOUR) continue;
      opts.push({
        value: d,
        label:
          d === 0 ? 'Later today' : d === 1 ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'long' }),
      });
    }
    return opts;
  }, []);

  const hourOptions = useMemo(() => {
    const opts: { value: number; label: string }[] = [];
    for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
      if (when === 0 && h <= now.getHours()) continue;
      opts.push({ value: h, label: hourLabel(h) });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when]);

  // The window this post will cover, or null until a start time is picked.
  const slot = useMemo(() => {
    if (when === 'now') {
      const start = new Date();
      return { startsAt: start, endsAt: new Date(start.getTime() + hours * 3600_000), hereNow: true };
    }
    if (hour == null || !hourOptions.some((o) => o.value === hour)) return null;
    const start = new Date();
    start.setDate(start.getDate() + when);
    start.setHours(hour, 0, 0, 0);
    return { startsAt: start, endsAt: new Date(start.getTime() + hours * 3600_000), hereNow: false };
  }, [when, hour, hours, hourOptions]);

  if (!user || !areaId) {
    return (
      <Screen title="Post to the board" showTitle={false}>
        <ThemedText>{user ? 'Pick a gym from the Partners tab first.' : 'Sign in to post.'}</ThemedText>
      </Screen>
    );
  }

  async function submit() {
    if (!slot || !areaId) return;
    setBusy(true);
    setError(null);
    try {
      const post = await createPost({
        areaId,
        areaName,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        hereNow: slot.hereNow,
        goal,
        styles: styles_,
        gradeLow,
        gradeHigh,
        mentoring,
        note,
      });
      router.replace({ pathname: '/partners/post', params: { id: post.id } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen title="Post to the board" showTitle={false}>
      <View>
        <ThemedText type="subtitle">{areaName}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Only signed-in climbers see the board. Your post shows the gym and time, never your location, and
          disappears when the session ends.
        </ThemedText>
      </View>

      <SingleChoice
        label="When"
        showLabel
        value={when}
        onChange={(v) => {
          setWhen(v);
          setHour(null);
        }}
        options={dayOptions}
      />
      {when !== 'now' && (
        <SingleChoice label="Starting at" showLabel value={hour ?? -1} onChange={setHour} options={hourOptions} />
      )}
      <SingleChoice
        label={when === 'now' ? 'Here for' : 'For'}
        showLabel
        value={hours}
        onChange={setHours}
        options={DURATIONS.map((d) => ({ value: d, label: d === 1 ? '1 hour' : `${d} hours` }))}
      />

      <SingleChoice
        label="Session goal"
        showLabel
        value={goal}
        onChange={(g) => {
          setGoal(g);
          setStyles(GOAL_STYLES[g]);
        }}
        options={(Object.keys(GOAL_LABELS) as SessionGoal[]).map((g) => ({ value: g, label: GOAL_LABELS[g] }))}
      />
      <ChipGroup
        label="Climbing"
        selected={styles_}
        onChange={setStyles}
        options={(Object.keys(POST_STYLE_LABELS) as BelayPost['styles']).map((s) => ({
          value: s,
          label: POST_STYLE_LABELS[s],
        }))}
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Grades from" placeholder="5.10a" value={gradeLow} onChangeText={setGradeLow} maxLength={10} autoCapitalize="none" />
        </View>
        <View style={styles.flex}>
          <Field label="to" placeholder="5.11a" value={gradeHigh} onChangeText={setGradeHigh} maxLength={10} autoCapitalize="none" />
        </View>
      </View>
      <ToggleRow label="Happy to mentor someone newer" value={mentoring} onValueChange={setMentoring} />
      <Field
        label="Note (optional)"
        placeholder="Working the blue 5.11 in the cave, happy to swap belays."
        value={note}
        onChangeText={setNote}
        maxLength={280}
        multiline
      />

      {slot && (
        <ThemedText type="small" themeColor="textSecondary">
          {formatWindow({
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
            hereNow: slot.hereNow,
          })}
        </ThemedText>
      )}
      <Button
        title="Post to the board"
        onPress={submit}
        loading={busy}
        disabled={!slot || styles_.length === 0}
      />
      {error && (
        <ThemedText type="small" style={{ color: theme.accent }}>
          {error}
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three },
  flex: { flex: 1 },
});

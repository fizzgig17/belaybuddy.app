import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Segmented, SingleChoice, ToggleRow } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  deleteClimb,
  describeSummary,
  endSession,
  fetchActiveSession,
  formatDuration,
  gradesFor,
  hardest,
  logClimb,
  RESULT_LABELS,
  startSession,
  summarize,
  type ClimbLog,
  type GradeMod,
  type ClimbSession,
  type Discipline,
  type Result,
} from '@/lib/climb-log';
import { success, tap } from '@/lib/haptics';
import { useFavorites } from '@/lib/favorites';
import { checkIn, checkOut } from '@/lib/friends';
import { useHomeGyms } from '@/lib/home-gyms';

const OTHER = '__other__';
const DEFAULT_GRADE: Record<Discipline, string> = { boulder: 'V2', route: '5.9' };

function lastGrade(d: Discipline): string {
  try {
    return globalThis.localStorage?.getItem(`bb.lastGrade.${d}`) || DEFAULT_GRADE[d];
  } catch {
    return DEFAULT_GRADE[d];
  }
}
function rememberGrade(d: Discipline, g: string) {
  try {
    globalThis.localStorage?.setItem(`bb.lastGrade.${d}`, g);
  } catch {
    // convenience only
  }
}

export default function SessionScreen() {
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ areaId?: string; name?: string }>();
  const [session, setSession] = useState<ClimbSession | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchActiveSession()
        .then(setSession)
        .catch((e: Error) => {
          setSession(null);
          setError(e.message);
        });
    }, [user]),
  );

  if (authLoading || (user && session === undefined)) {
    return (
      <Screen title="Session" showTitle={false}>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="Session" showTitle={false}>
        <ThemedText>Sign in to log your climbs.</ThemedText>
        <Button title="Sign in" onPress={() => router.push('/profile')} />
      </Screen>
    );
  }

  return (
    <Screen title="Session" showTitle={false}>
      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
      {session ? (
        <Logger session={session} onChange={setSession} />
      ) : (
        <StartCard
          presetArea={params.areaId ? { areaId: params.areaId, areaName: params.name ?? 'This gym' } : null}
          onStarted={setSession}
          onError={setError}
        />
      )}
    </Screen>
  );
}

function StartCard({
  presetArea,
  onStarted,
  onError,
}: {
  presetArea: { areaId: string; areaName: string } | null;
  onStarted: (s: ClimbSession) => void;
  onError: (m: string | null) => void;
}) {
  const { homeGyms } = useHomeGyms();
  const { favorites } = useFavorites();
  // Where you can start: the place you came from, home gyms, then saved gyms and crags.
  const places = new Map<string, string>();
  if (presetArea) places.set(presetArea.areaId, presetArea.areaName);
  for (const g of homeGyms) if (!places.has(g.areaId)) places.set(g.areaId, g.name);
  for (const f of favorites) if (!places.has(f.areaId)) places.set(f.areaId, f.name);
  const options = [
    ...[...places].map(([value, label]) => ({ value, label })),
    { value: OTHER, label: 'Somewhere else' },
  ];
  const [picked, setPicked] = useState<string>(options[0].value);
  const [tellFriends, setTellFriends] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    onError(null);
    try {
      const chosen = picked === OTHER ? null : options.find((o) => o.value === picked);
      onStarted(await startSession(chosen ? { areaId: chosen.value, areaName: chosen.label } : null));
      // Opt-in: friends see "at <place>" for 4 hours, or until you end the session.
      if (chosen && tellFriends) await checkIn(chosen.value, chosen.label, 4).catch(() => {});
      success();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ThemedText type="subtitle" accessibilityRole="header">
        Start a session
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Log each climb with one tap while you climb. Only you can see your log.
      </ThemedText>
      <SingleChoice label="Where are you climbing?" showLabel options={options} value={picked} onChange={setPicked} />
      <ThemedText type="small" themeColor="textSecondary">
        Not listed? Open the gym or crag from the Find tab and tap “Start a climbing session here”, or save it to see it here.
      </ThemedText>
      {picked !== OTHER && (
        <ToggleRow label="Let my friends know I’m here" value={tellFriends} onValueChange={setTellFriends} />
      )}
      <Button title="Start session" onPress={start} loading={busy} />
      <Button title="Past sessions" variant="secondary" onPress={() => router.push('/partners/sessions')} />
    </>
  );
}

function Logger({ session, onChange }: { session: ClimbSession; onChange: (s: ClimbSession | null) => void }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [discipline, setDiscipline] = useState<Discipline>('boulder');
  const [grade, setGrade] = useState(lastGrade('boulder'));
  const [mod, setMod] = useState<GradeMod>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState<ClimbSession | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function pickDiscipline(d: Discipline) {
    setDiscipline(d);
    setGrade(lastGrade(d));
    setMod('');
  }
  function pickGrade(g: string) {
    tap();
    setGrade(g);
    setMod('');
    rememberGrade(discipline, g);
  }

  // What gets logged and shown on the buttons: "5.10+", "V4-".
  const shownGrade = grade + mod;

  async function log(result: Result) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await logClimb(session.id, discipline, shownGrade, result);
      onChange({ ...session, logs: [...session.logs, entry] });
      if (result === 'attempt') tap();
      else success();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function undo(entry: ClimbLog) {
    try {
      await deleteClimb(entry.id);
      onChange({ ...session, logs: session.logs.filter((l) => l.id !== entry.id) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function finish() {
    try {
      await endSession(session.id);
      // Ending the session also ends a check-in made for it.
      if (user) await checkOut(user.id).catch(() => {});
      setFinished({ ...session, endedAt: new Date().toISOString() });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function confirmFinish() {
    if (Platform.OS === 'web') return finish();
    Alert.alert('End this session?', undefined, [
      { text: 'Keep climbing', style: 'cancel' },
      { text: 'End session', onPress: finish },
    ]);
  }

  if (finished) {
    const s = summarize(finished.logs);
    return (
      <>
        <ThemedText type="subtitle" accessibilityRole="header">
          Nice session
        </ThemedText>
        <Card>
          <ThemedText type="smallBold">{finished.areaName ?? 'Outdoors'}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {formatDuration(finished.startedAt, finished.endedAt)} · {s.climbs} {s.climbs === 1 ? 'climb' : 'climbs'}
          </ThemedText>
          <ThemedText>{describeSummary(s)}</ThemedText>
          {hardest(s) && <ThemedText>Hardest send: {hardest(s)}</ThemedText>}
        </Card>
        <Button title="Done" onPress={() => { onChange(null); router.back(); }} />
        <Button title="Past sessions" variant="secondary" onPress={() => { onChange(null); router.replace('/partners/sessions'); }} />
      </>
    );
  }

  const s = summarize(session.logs);
  const recent = [...session.logs].reverse().slice(0, 8);
  const grades = gradesFor(discipline);

  return (
    <>
      <View>
        <ThemedText type="subtitle" accessibilityRole="header">
          {session.areaName ?? 'Outdoors'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {formatDuration(session.startedAt, null, now)} · {describeSummary(s)}
          {hardest(s) ? ` · hardest ${hardest(s)}` : ''}
        </ThemedText>
      </View>

      <Segmented
        label="Type of climbing"
        value={discipline}
        onChange={pickDiscipline}
        options={[
          { value: 'boulder', label: 'Bouldering' },
          { value: 'route', label: 'Routes' },
        ]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grades} keyboardShouldPersistTaps="handled">
        {grades.map((g) => {
          const on = g === grade;
          return (
            <Pressable
              key={g}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => pickGrade(g)}
              style={[styles.grade, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.border }]}>
              <ThemedText type="smallBold" style={{ color: on ? theme.onAccent : theme.text }}>
                {g}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <Segmented
        label="Minus, exact or plus"
        value={mod}
        onChange={(m) => {
          tap();
          setMod(m);
        }}
        options={[
          { value: '-', label: `${grade} −` },
          { value: '', label: grade },
          { value: '+', label: `${grade} +` },
        ]}
      />

      <View style={styles.big}>
        <BigButton label="Sent" sub={shownGrade} color={HoldColors.green} onPress={() => log('send')} disabled={busy} />
        <BigButton label="Flash" sub={shownGrade} color={HoldColors.yellow} dark onPress={() => log('flash')} disabled={busy} />
        <BigButton label="Attempt" sub={shownGrade} color={theme.backgroundSelected} dark onPress={() => log('attempt')} disabled={busy} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Sent: you finished it. Flash: you finished it on your first try. Attempt: you tried but didn’t finish.
      </ThemedText>
      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

      {recent.length > 0 && (
        <Card style={styles.list}>
          <ThemedText type="smallBold">This session</ThemedText>
          {recent.map((l, i) => (
            <View key={l.id} style={[styles.logRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <ThemedText type="smallBold" style={styles.logGrade}>{l.grade}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {RESULT_LABELS[l.result]} · {l.discipline === 'boulder' ? 'Boulder' : 'Route'} ·{' '}
                {new Date(l.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </ThemedText>
              <Pressable onPress={() => undo(l)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${l.grade} ${RESULT_LABELS[l.result]}`}>
                <ThemedText type="small" style={{ color: theme.accent }}>Remove</ThemedText>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Button title="End session" variant="secondary" onPress={confirmFinish} />
    </>
  );
}

function BigButton({
  label,
  sub,
  color,
  dark,
  onPress,
  disabled,
}: {
  label: string;
  sub: string;
  color: string;
  dark?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const text = dark ? '#1F2D35' : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${sub}`}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.bigButton, { backgroundColor: color, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: text === '#1F2D35' && color === theme.backgroundSelected ? theme.text : text }}>
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={{ color: color === theme.backgroundSelected ? theme.text : text }}>
        {sub}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { color: '#C0392B' },
  grades: { gap: Spacing.two, paddingVertical: Spacing.one },
  grade: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, borderRadius: 999, borderWidth: 1, minWidth: 52, alignItems: 'center' },
  big: { flexDirection: 'row', gap: Spacing.two },
  bigButton: { flex: 1, minHeight: 96, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  list: { gap: 0, paddingVertical: Spacing.two },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two + 2 },
  logGrade: { width: 52 },
});

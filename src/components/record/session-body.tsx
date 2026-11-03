import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Segmented, SingleChoice, ToggleRow } from '@/components/form';
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
  colorHex,
  formatDuration,
  gradesFor,
  hardest,
  logClimb,
  RESULT_LABELS,
  ROUTE_COLORS,
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
import { setSessionActive } from '@/lib/active-session';
import { useHomeGyms } from '@/lib/home-gyms';
import { useAiConsent } from '@/lib/ai-consent';
import { scanRouteTag } from '@/lib/route-tag';

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

/** The session page's content: sign-in prompt, the start card, or the climb logger. Used by the page and the record sheet. */
export function SessionBody() {
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<ClimbSession | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Keeps the round button's caption (Record session / End session) in step.
  const update = (s: ClimbSession | null) => {
    setSession(s);
    setSessionActive(!!s);
  };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchActiveSession()
        .then((s) => {
          setSession(s);
          setSessionActive(!!s);
        })
        .catch((e: Error) => {
          setSession(null);
          setError(e.message);
        });
    }, [user]),
  );

  if (authLoading || (user && session === undefined)) return <ActivityIndicator />;
  if (!user) {
    return (
      <>
        <ThemedText>Sign in to log your climbs.</ThemedText>
        <Button title="Sign in" onPress={() => router.push('/profile')} />
      </>
    );
  }

  return (
    <>
      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
      {session ? (
        <Logger session={session} onChange={update} />
      ) : (
        <StartCard onStarted={update} onError={setError} />
      )}
    </>
  );
}

function StartCard({
  onStarted,
  onError,
}: {
  onStarted: (s: ClimbSession) => void;
  onError: (m: string | null) => void;
}) {
  const { homeGyms } = useHomeGyms();
  const { favorites } = useFavorites();
  // Where you can start: home gyms, then saved gyms and crags.
  const places = new Map<string, string>();
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
        Not listed? Save the gym or crag from the Find tab and it will show up here.
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
  const [color, setColor] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [tagNote, setTagNote] = useState<string | null>(null);
  const { consent, set: setConsent } = useAiConsent();

  async function scanTag() {
    if (scanning) return;
    setError(null);
    setTagNote(null);
    setScanning(true);
    try {
      const res = await scanRouteTag();
      if (!res) return;
      if ('error' in res) return setError(res.error);
      const t = res.tag;
      setDiscipline(t.discipline);
      setGrade(t.grade);
      setMod(t.mod);
      setColor(t.color || null);
      if (t.name) setRouteName(t.name);
      rememberGrade(t.discipline, t.grade);
      success();
      const label = ROUTE_COLORS.find((c) => c.key === t.color)?.label;
      const bits = [label ? `${label} hold` : '', t.name, t.setter ? `set by ${t.setter}` : ''].filter(Boolean);
      setTagNote(`Read ${t.grade}${t.mod}${bits.length ? ` · ${bits.join(' · ')}` : ''}. Check it below, then tap Sent, Flash or Attempt.`);
    } finally {
      setScanning(false);
    }
  }

  function askScan() {
    if (consent === 'allowed') return void scanTag();
    if (consent === 'loading') return;
    const msg = 'The photo of the tag is sent to an AI service to read it. Turn on AI features to use this?';
    if (Platform.OS === 'web') return;
    Alert.alert('Scan the route tag', msg, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Turn on AI', onPress: () => void setConsent('allowed').then(scanTag) },
    ]);
  }

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
      const entry = await logClimb(session.id, discipline, shownGrade, result, { color, routeName });
      onChange({ ...session, logs: [...session.logs, entry] });
      // The next climb is a different route: clear what belonged to this one. The grade stays, since it's usually close.
      setColor(null);
      setRouteName('');
      setTagNote(null);
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
      setSessionActive(false);
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
        <Button title="Past sessions" variant="secondary" onPress={() => { onChange(null); router.back(); router.push('/partners/sessions'); }} />
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

      {Platform.OS !== 'web' && (
        <Button title={scanning ? 'Reading the tag…' : 'Photograph the route tag'} onPress={askScan} disabled={scanning} />
      )}
      {tagNote && <ThemedText type="small" themeColor="textSecondary">{tagNote}</ThemedText>}

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

      <ThemedText type="smallBold">Route color</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grades} keyboardShouldPersistTaps="handled">
        {ROUTE_COLORS.map((c) => {
          const on = c.key === color;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`${c.label} route`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                setColor(on ? null : c.key);
              }}
              style={[styles.swatchRing, { borderColor: on ? theme.accent : 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: c.hex, borderColor: theme.border }]} />
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput
        value={routeName}
        onChangeText={setRouteName}
        placeholder="Route name (optional)"
        placeholderTextColor={theme.textSecondary}
        maxLength={60}
        returnKeyType="done"
        style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
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
              {colorHex(l.color) && <View style={[styles.dot, { backgroundColor: colorHex(l.color)!, borderColor: theme.border }]} />}
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {l.routeName ? `${l.routeName} · ` : ''}{RESULT_LABELS[l.result]} · {l.discipline === 'boulder' ? 'Boulder' : 'Route'} ·{' '}
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
  swatchRing: { padding: 3, borderRadius: 999, borderWidth: 2 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  nameInput: { borderWidth: 1, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, fontSize: 16 },
});

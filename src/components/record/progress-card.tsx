import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button, Segmented } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { gradesFor, RESULT_LABELS, type ClimbSession, type Discipline } from '@/lib/climb-log';
import { requirePlus, usePlus } from '@/lib/purchases';

/** The base grade (5.10b+ -> 5.10b) so a "+" or "-" counts with its grade. */
const base = (g: string) => g.replace(/[+-]$/, '');

/** One row per climb: for a spreadsheet. */
export function sessionsToCsv(sessions: ClimbSession[]): string {
  const q = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const rows = ['date,place,discipline,grade,result,color,route,wall_height_ft'];
  for (const s of sessions) {
    for (const l of s.logs) {
      rows.push([q(l.loggedAt), q(s.areaName), l.discipline, q(l.grade), l.result, q(l.color), q(l.routeName), l.wallHeight ?? ''].join(','));
    }
  }
  return rows.join('\n');
}

/**
 * Plus: grade pyramid, flash rate and an export of every climb. Shown only when purchases are switched on; people
 * without Plus see what it holds and a button that opens the paywall.
 */
export function ProgressCard({ sessions }: { sessions: ClimbSession[] }) {
  const theme = useTheme();
  const { enabled, isPlus } = usePlus();
  const logs = useMemo(() => sessions.flatMap((s) => s.logs), [sessions]);
  const counts = (d: Discipline) => logs.filter((l) => l.discipline === d && l.result !== 'attempt').length;
  const [pick, setPick] = useState<Discipline | null>(null);
  const discipline: Discipline = pick ?? (counts('boulder') > counts('route') ? 'boulder' : 'route');

  if (!enabled) return null;

  if (!isPlus) {
    return (
      <Card>
        <ThemedText type="smallBold">Your progress</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          See your grade pyramid and flash rate, and export every climb to a spreadsheet.
        </ThemedText>
        <Button title="Unlock with Plus" onPress={() => void requirePlus()} />
      </Card>
    );
  }

  const done = logs.filter((l) => l.discipline === discipline && l.result !== 'attempt');
  const byGrade = new Map<string, number>();
  for (const l of done) byGrade.set(base(l.grade), (byGrade.get(base(l.grade)) ?? 0) + 1);
  const order = gradesFor(discipline);
  const present = order.filter((g) => byGrade.has(g));
  const lo = present.length ? order.indexOf(present[0]) : 0;
  const hi = present.length ? order.indexOf(present[present.length - 1]) : 0;
  const shown = present.length ? order.slice(lo, hi + 1) : [];
  const max = Math.max(1, ...shown.map((g) => byGrade.get(g) ?? 0));

  const all = logs.length;
  const sends = logs.filter((l) => l.result !== 'attempt').length;
  const flashes = logs.filter((l) => l.result === 'flash').length;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');

  return (
    <Card>
      <ThemedText type="smallBold">Your progress</ThemedText>
      <Segmented
        label="Grade pyramid for"
        value={discipline}
        onChange={setPick}
        options={[
          { value: 'route', label: 'Routes' },
          { value: 'boulder', label: 'Boulders' },
        ]}
      />
      {shown.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No {discipline === 'boulder' ? 'boulder' : 'route'} sends yet.
        </ThemedText>
      ) : (
        <View style={styles.bars} accessibilityLabel="Grade pyramid">
          {[...shown].reverse().map((g) => {
            const n = byGrade.get(g) ?? 0;
            return (
              <View key={g} style={styles.barRow}>
                <ThemedText type="small" style={styles.grade}>{g}</ThemedText>
                <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.fill, { width: `${(n / max) * 100}%`, backgroundColor: theme.accent }]} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.count}>{n}</ThemedText>
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.stats}>
        <Mini label="Climbs" value={String(all)} />
        <Mini label="Send rate" value={pct(sends, all)} />
        <Mini label="Flash rate" value={pct(flashes, sends)} />
      </View>
      <Button
        title="Export climbs (CSV)"
        variant="secondary"
        onPress={() => void Share.share({ title: 'Belay Buddy climbs', message: sessionsToCsv(sessions) }).catch(() => {})}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {RESULT_LABELS.send} and {RESULT_LABELS.flash.toLowerCase()} climbs count as sends. Attempts do not.
      </ThemedText>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grade: { width: 52 },
  track: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden' },
  fill: { height: 14, borderRadius: 7 },
  count: { width: 24, textAlign: 'right' },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  mini: { flex: 1, alignItems: 'center' },
});

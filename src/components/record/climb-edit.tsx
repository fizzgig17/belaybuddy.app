import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Field, Segmented } from '@/components/form';
import { ColorPicker } from '@/components/record/color-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cleanWallHeight,
  gradesFor,
  RESULT_LABELS,
  updateClimb,
  type ClimbLog,
  type Discipline,
  type GradeMod,
  type Result,
} from '@/lib/climb-log';
import { success, tap } from '@/lib/haptics';

/** "5.10+" -> { base: "5.10", mod: "+" }. A grade with no sign has an empty mod. */
function splitGrade(grade: string): { base: string; mod: GradeMod } {
  const mod = (/[+-]$/.exec(grade)?.[0] ?? '') as GradeMod;
  return { base: mod ? grade.slice(0, -1) : grade, mod };
}

/**
 * Change a logged climb: type, grade, result, hold color, name and wall height. Opens as a sheet; Save writes the
 * change and hands the updated climb to `onSaved`.
 */
export function ClimbEditor({
  log,
  onClose,
  onSaved,
}: {
  log: ClimbLog | null;
  onClose: () => void;
  onSaved: (updated: ClimbLog) => void;
}) {
  const theme = useTheme();
  const [discipline, setDiscipline] = useState<Discipline>('route');
  const [base, setBase] = useState('');
  const [mod, setMod] = useState<GradeMod>('');
  const [result, setResult] = useState<Result>('send');
  const [color, setColor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the climb each time the sheet opens.
  useEffect(() => {
    if (!log) return;
    const g = splitGrade(log.grade);
    setDiscipline(log.discipline);
    setBase(g.base);
    setMod(g.mod);
    setResult(log.result);
    setColor(log.color);
    setName(log.routeName ?? '');
    setHeight(log.wallHeight ? String(log.wallHeight) : '');
    setError(null);
    setBusy(false);
  }, [log]);

  if (!log) return null;

  // The climb's own grade stays pickable even if the list does not have it (an old "5.10+", say).
  const list = gradesFor(discipline);
  const grades = base && !list.includes(base) ? [base, ...list] : list;

  function pickDiscipline(d: Discipline) {
    setDiscipline(d);
    const next = gradesFor(d);
    if (!next.includes(base)) {
      setBase(d === 'boulder' ? 'V2' : '5.9');
      setMod('');
    }
  }

  async function save() {
    if (!log || busy) return;
    if (height.trim() && cleanWallHeight(height) === null) return setError('Wall height is a whole number of feet, 1 to 500.');
    setBusy(true);
    setError(null);
    try {
      const updated = await updateClimb(log.id, {
        discipline,
        grade: base + mod,
        result,
        color,
        routeName: name,
        wallHeight: cleanWallHeight(height),
      });
      success();
      onSaved(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets>
          <ThemedText type="subtitle" accessibilityRole="header">
            Edit climb
          </ThemedText>

          <Segmented
            label="Type of climbing"
            value={discipline}
            onChange={pickDiscipline}
            options={[
              { value: 'boulder', label: 'Boulder' },
              { value: 'route', label: 'Routes' },
            ]}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grades} keyboardShouldPersistTaps="handled">
            {grades.map((g) => {
              const on = g === base;
              return (
                <Pressable
                  key={g}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    tap();
                    setBase(g);
                    setMod('');
                  }}
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
            onChange={setMod}
            options={[
              { value: '-', label: `${base} −` },
              { value: '', label: base },
              { value: '+', label: `${base} +` },
            ]}
          />

          <Segmented
            label="Result"
            value={result}
            onChange={setResult}
            options={(['send', 'flash', 'attempt'] as Result[]).map((r) => ({ value: r, label: RESULT_LABELS[r] }))}
          />

          <View style={styles.group}>
            <ThemedText type="smallBold">Hold color</ThemedText>
            <ColorPicker value={color} onChange={setColor} />
          </View>

          <Field label="Route name" value={name} onChangeText={setName} placeholder="Optional" maxLength={60} />
          <Field
            label="Wall height (feet)"
            value={height}
            onChangeText={(t) => setHeight(t.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="Optional"
            keyboardType="number-pad"
            maxLength={3}
          />

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" onPress={onClose} />
            </View>
            <View style={styles.flex}>
              <Button title="Save" onPress={save} loading={busy} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.six * 2, gap: Spacing.three, maxWidth: 560, width: '100%', alignSelf: 'center' },
  grades: { gap: Spacing.two, paddingVertical: 2, alignItems: 'center' },
  grade: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, borderWidth: 1, minWidth: 52, alignItems: 'center' },
  group: { gap: Spacing.two },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  error: { color: '#C0392B' },
});

import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Field, ToggleRow } from '@/components/form';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { DAY_NAMES, hoursToOsm, suggestHours, type DayHours } from '@/lib/place-edits';

const blank = (): DayHours[] => DAY_NAMES.map(() => ({ closed: false, open: '', close: '' }));

/**
 * "Add the hours" for a gym or shop that has none. Signed-in people fill in a week;
 * it goes to a review queue and shows once approved.
 */
export function SuggestHours({ place, compact = false }: { place: { id: string; name: string; kind: 'gym' | 'shop' }; compact?: boolean }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<DayHours[]>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return compact ? (
      <ThemedText type="small" themeColor="textSecondary">
        Hours sent
      </ThemedText>
    ) : (
      <ThemedText type="small" themeColor="textSecondary">
        Thanks. We'll review those hours.
      </ThemedText>
    );
  }
  if (!user) {
    if (compact) return <IconButton tipAbove icon="clock" label="Sign in to add the hours" onPress={() => router.push('/profile')} />;
    return (
      <Link href="/profile" asChild>
        <Pressable accessibilityRole="link">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Sign in to add the hours
          </ThemedText>
        </Pressable>
      </Link>
    );
  }

  const set = (i: number, patch: Partial<DayHours>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function send() {
    const result = hoursToOsm(days);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await suggestHours(place, result.value);
      setSent(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {compact ? (
        <IconButton tipAbove icon="clock" label="Add the hours" onPress={() => setOpen(true)} />
      ) : (
        <Button title="Add the hours" variant="secondary" onPress={() => setOpen(true)} />
      )}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        {/* The keyboard must not cover the lower days: iPhone lets the scroll view make room, Android shrinks the sheet. */}
        <KeyboardAvoidingView
          enabled={Platform.OS === 'android'}
          behavior="height"
          style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets>
            <ThemedText type="subtitle" accessibilityRole="header">
              Hours for {place.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Only add hours you know are right, for example from the {place.kind === 'gym' ? 'gym' : 'shop'}'s website or
              door. Times like 9am, 9:30pm or 21:00 all work. We review each one before it shows.
            </ThemedText>
            {days.map((d, i) => (
              <View key={DAY_NAMES[i]} style={styles.day}>
                <ToggleRow
                  label={`${DAY_NAMES[i]}: closed`}
                  value={d.closed}
                  onValueChange={(closed) => set(i, { closed })}
                />
                {!d.closed && (
                  <View style={styles.times}>
                    <View style={styles.time}>
                      <Field label="Opens" value={d.open} onChangeText={(open) => set(i, { open })} placeholder="9am" autoCapitalize="none" />
                    </View>
                    <View style={styles.time}>
                      <Field label="Closes" value={d.close} onChangeText={(close) => set(i, { close })} placeholder="9pm" autoCapitalize="none" />
                    </View>
                  </View>
                )}
              </View>
            ))}
            <Button
              title="Copy Monday to every day"
              variant="secondary"
              onPress={() => setDays((d) => d.map(() => ({ ...d[0] })))}
            />
            {error && (
              <ThemedText type="small" style={{ color: '#C0392B' }}>
                {error}
              </ThemedText>
            )}
            <View style={styles.buttons}>
              <View style={styles.flex}>
                <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} />
              </View>
              <View style={styles.flex}>
                <Button title="Send for review" onPress={send} loading={busy} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.six * 2, gap: Spacing.three, maxWidth: 560, width: '100%', alignSelf: 'center' },
  day: { gap: Spacing.two },
  times: { flexDirection: 'row', gap: Spacing.two },
  time: { flex: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});

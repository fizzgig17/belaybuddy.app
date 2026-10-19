import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { formatOpeningHours } from '@/lib/hours';
import {
  addAdminByCode,
  fetchAdmins,
  fetchPendingEdits,
  removeAdmin,
  reviewEdit,
  useIsAdmin,
  type AdminPerson,
  type PendingEdit,
} from '@/lib/admin';

function Hours({ value }: { value: string }) {
  const lines = formatOpeningHours(value);
  if (!lines) return <ThemedText type="small">{value}</ThemedText>;
  return (
    <View>
      {lines.map((l) => (
        <ThemedText key={l.days} type="small">
          {l.days}: {l.hours}
        </ThemedText>
      ))}
    </View>
  );
}

/** Admin-only: approve or reject suggested opening hours, and manage who else is an admin. */
export default function AdminScreen() {
  const isAdmin = useIsAdmin();
  const [edits, setEdits] = useState<PendingEdit[] | null>(null);
  const [admins, setAdmins] = useState<AdminPerson[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, a] = await Promise.all([fetchPendingEdits(), fetchAdmins()]);
      setEdits(e);
      setAdmins(a);
    } catch (err) {
      setError((err as Error).message);
      setEdits([]);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function review(edit: PendingEdit, approve: boolean) {
    setBusy(edit.id);
    setError(null);
    try {
      await reviewEdit(edit.id, approve);
      setEdits((list) => (list ?? []).filter((x) => x.id !== edit.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    setNote(null);
    setError(null);
    try {
      const name = await addAdminByCode(code);
      if (name) {
        setNote(`${name} is now an admin.`);
        setCode('');
        load();
      } else setNote('No one has that friend code.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(a: AdminPerson) {
    setError(null);
    try {
      await removeAdmin(a.userId);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Screen title="Admin" showTitle={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Admin', headerBackTitle: 'Back' }} />
      <ThemedText type="subtitle" accessibilityRole="header">Admin</ThemedText>
      {!isAdmin ? (
        <ThemedText themeColor="textSecondary">This page is for Belay Buddy admins.</ThemedText>
      ) : (
        <>
          {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
          <ThemedText type="smallBold" accessibilityRole="header">Opening hours to review</ThemedText>
          {edits === null ? (
            <ActivityIndicator />
          ) : edits.length === 0 ? (
            <ThemedText themeColor="textSecondary">Nothing waiting for review.</ThemedText>
          ) : (
            edits.map((e) => (
              <Card key={e.id} style={styles.card}>
                <ThemedText type="smallBold">{e.placeName}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {e.kind === 'gym' ? 'Gym' : 'Shop'} · from {e.submittedBy} · {new Date(e.createdAt).toLocaleDateString()}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Suggested</ThemedText>
                <Hours value={e.value} />
                {e.currentValue && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">Currently approved</ThemedText>
                    <Hours value={e.currentValue} />
                  </>
                )}
                <View style={styles.buttons}>
                  <View style={styles.flex}>
                    <Button title="Reject" variant="secondary" disabled={busy === e.id} onPress={() => review(e, false)} />
                  </View>
                  <View style={styles.flex}>
                    <Button title="Approve" loading={busy === e.id} onPress={() => review(e, true)} />
                  </View>
                </View>
              </Card>
            ))
          )}

          <ThemedText type="smallBold" accessibilityRole="header">Admins</ThemedText>
          {admins.map((a) => (
            <Card key={a.userId} style={styles.adminRow}>
              <ThemedText style={styles.flex}>{a.displayName}{a.isMe ? ' (you)' : ''}</ThemedText>
              {!a.isMe && <Button title="Remove" variant="secondary" onPress={() => remove(a)} />}
            </Card>
          ))}
          <Field
            label="Add an admin"
            hint="Ask them for their friend code (Partners > Friends)."
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {note && <ThemedText type="small">{note}</ThemedText>}
          <Button title="Make admin" disabled={code.trim().length < 4} onPress={add} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.one },
  buttons: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  flex: { flex: 1 },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  error: { color: '#d33' },
});

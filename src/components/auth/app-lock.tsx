import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { biometricLabel, confirmWithBiometrics } from '@/lib/biometrics';
import { getBiometricLock } from '@/lib/session-prefs';

/** Ask again after the app has been in the background this long. */
const GRACE_MS = 60_000;

/**
 * Covers the app until Face ID (or the device passcode) succeeds, when the
 * user has turned "Unlock with Face ID" on. Locks on launch and after the app
 * has been in the background for more than a minute.
 */
export function AppLock() {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const [locked, setLocked] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const backgroundedAt = useRef<number | null>(null);
  const checkedLaunch = useRef(false);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await confirmWithBiometrics('Unlock Belay Buddy');
    prompting.current = false;
    if (ok) setLocked(false);
  }, []);

  // Lock on launch once the stored session has loaded.
  useEffect(() => {
    if (loading || checkedLaunch.current) return;
    checkedLaunch.current = true;
    if (user && getBiometricLock()) {
      setLocked(true);
      biometricLabel().then((l) => l && setLabel(l));
    }
  }, [loading, user]);

  // Lock again after time in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current != null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > GRACE_MS && user && getBiometricLock()) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [user]);

  // Prompt automatically whenever the lock appears.
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  // Signing out (from here or anywhere) always clears the lock.
  useEffect(() => {
    if (!user) setLocked(false);
  }, [user]);

  if (!locked) return null;

  return (
    <ThemedView style={[StyleSheet.absoluteFill, styles.container]}>
      <View style={styles.center}>
        <SymbolView name={Icons.lock} size={44} tintColor={theme.accent} />
        <ThemedText type="subtitle">Belay Buddy is locked</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          Use {label} to open the app.
        </ThemedText>
      </View>
      <View style={styles.buttons}>
        <Button title={`Unlock with ${label}`} onPress={unlock} />
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { zIndex: 1000, padding: Spacing.four, justifyContent: 'space-between', paddingVertical: Spacing.six * 1.5 },
  center: { alignItems: 'center', gap: Spacing.three, marginTop: Spacing.six },
  text: { textAlign: 'center' },
  buttons: { gap: Spacing.two },
});

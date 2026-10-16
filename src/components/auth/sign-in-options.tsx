import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ToggleRow } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { biometricLabel, confirmWithBiometrics } from '@/lib/biometrics';
import { getBiometricLock, getKeepSignedIn, setBiometricLock, setKeepSignedIn } from '@/lib/session-prefs';

/**
 * "Keep me signed in" and, in the app, "Unlock with Face ID". Used on the
 * sign-in screen and in Profile > Privacy & safety.
 */
export function SignInOptions() {
  const [keep, setKeep] = useState(true);
  const [lock, setLock] = useState(false);
  const [bio, setBio] = useState<string | null>(null);

  // Read saved choices after mount so the website's pre-rendered HTML matches.
  useEffect(() => {
    setKeep(getKeepSignedIn());
    setLock(getBiometricLock());
    biometricLabel().then(setBio);
  }, []);

  function changeKeep(on: boolean) {
    setKeepSignedIn(on);
    setKeep(on);
    if (!on) setLock(false);
  }

  async function changeLock(on: boolean) {
    // Check it works (and get iOS's Face ID permission) before relying on it.
    if (on && !(await confirmWithBiometrics(`Turn on ${bio} for Belay Buddy`))) return;
    setBiometricLock(on);
    setLock(on);
  }

  return (
    <View style={styles.container}>
      <ToggleRow label="Keep me signed in" value={keep} onValueChange={changeKeep} />
      {bio && keep && <ToggleRow label={`Unlock with ${bio}`} value={lock} onValueChange={changeLock} />}
      <ThemedText type="small" themeColor="textSecondary">
        {keep
          ? bio
            ? `You'll stay signed in on this device. With ${bio} on, the app asks for it when you open it.`
            : "You'll stay signed in on this device."
          : process.env.EXPO_OS === 'web'
            ? "You'll be signed out when you close this tab. Use this on shared computers."
            : "You'll be signed out when you close the app."}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
});

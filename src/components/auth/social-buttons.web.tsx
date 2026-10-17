import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { googleEnabled, signInWithGoogle } from '@/lib/social-auth';

/** "Continue with Google" on the website (Apple sign-in is app-only for now). */
export function SocialButtons({ onError }: { onError: (message: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  if (!googleEnabled) return null;

  async function google() {
    setBusy(true);
    onError(null);
    const result = await signInWithGoogle();
    if (!result.ok) {
      setBusy(false);
      if (!result.canceled) onError(result.message);
    }
  }

  return (
    <View style={styles.container}>
      <Button title="Continue with Google" variant="secondary" loading={busy} onPress={google} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.or}>
        or use your email
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  or: { textAlign: 'center' },
});

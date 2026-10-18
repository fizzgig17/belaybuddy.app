import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  facebookEnabled,
  googleEnabled,
  signInWithFacebook,
  signInWithGoogle,
  type SocialResult,
} from '@/lib/social-auth';

/** "Continue with Google" and "Facebook" on the website (Apple sign-in is app-only for now). */
export function SocialButtons({ onError }: { onError: (message: string | null) => void }) {
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  if (!googleEnabled && !facebookEnabled) return null;

  async function run(which: 'google' | 'facebook', fn: () => Promise<SocialResult>) {
    if (busy) return;
    setBusy(which);
    onError(null);
    const result = await fn();
    // On success the browser is leaving for the provider, so keep the spinner.
    if (!result.ok) {
      setBusy(null);
      if (!result.canceled) onError(result.message);
    }
  }

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.or}>
        or continue with
      </ThemedText>
      {googleEnabled && (
        <Button
          title="Continue with Google"
          variant="secondary"
          loading={busy === 'google'}
          disabled={!!busy && busy !== 'google'}
          onPress={() => run('google', signInWithGoogle)}
        />
      )}
      {facebookEnabled && (
        <Button
          title="Continue with Facebook"
          variant="secondary"
          loading={busy === 'facebook'}
          disabled={!!busy && busy !== 'facebook'}
          onPress={() => run('facebook', signInWithFacebook)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  or: { textAlign: 'center' },
});

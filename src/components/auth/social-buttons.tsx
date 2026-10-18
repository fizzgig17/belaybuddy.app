import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  appleAvailable,
  facebookEnabled,
  googleEnabled,
  signInWithApple,
  signInWithFacebook,
  signInWithGoogle,
  type SocialResult,
} from '@/lib/social-auth';

/**
 * Google, Facebook and Apple (iPhone/iPad app), below the email sign-in. On success the auth listener swaps the screen out.
 */
export function SocialButtons({ onError }: { onError: (message: string | null) => void }) {
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | 'facebook' | null>(null);
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  if (!apple && !googleEnabled && !facebookEnabled) return null;

  async function run(which: 'apple' | 'google' | 'facebook', fn: () => Promise<SocialResult>) {
    if (busy) return;
    setBusy(which);
    onError(null);
    const result = await fn();
    setBusy(null);
    if (!result.ok && !result.canceled) onError(result.message);
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
      {apple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            dark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={Spacing.three}
          style={[styles.apple, busy ? styles.disabled : null]}
          onPress={() => run('apple', signInWithApple)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  apple: { height: 48, width: '100%' },
  disabled: { opacity: 0.5 },
  or: { textAlign: 'center' },
});

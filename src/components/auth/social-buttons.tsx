import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { appleAvailable, googleEnabled, signInWithApple, signInWithGoogle, type SocialResult } from '@/lib/social-auth';

/**
 * "Continue with Apple" (iPhone/iPad app) and "Continue with Google", above
 * the email sign-in. On success the auth listener swaps the screen out.
 */
export function SocialButtons({ onError }: { onError: (message: string | null) => void }) {
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  if (!apple && !googleEnabled) return null;

  async function run(which: 'apple' | 'google', fn: () => Promise<SocialResult>) {
    if (busy) return;
    setBusy(which);
    onError(null);
    const result = await fn();
    setBusy(null);
    if (!result.ok && !result.canceled) onError(result.message);
  }

  return (
    <View style={styles.container}>
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
      {googleEnabled && (
        <Button
          title="Continue with Google"
          variant="secondary"
          loading={busy === 'google'}
          disabled={!!busy && busy !== 'google'}
          onPress={() => run('google', signInWithGoogle)}
        />
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.or}>
        or use your email
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  apple: { height: 48, width: '100%' },
  disabled: { opacity: 0.5 },
  or: { textAlign: 'center' },
});

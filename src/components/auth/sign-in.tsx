import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Passwordless email sign-in: we email a one-time code, the user types it in.
 * The same flow creates the account on first use. No deep links required, so
 * it works the same on iOS, Android and the web.
 */
export function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const codeValid = /^\d{6,10}$/.test(code.trim());

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setCode('');
    setStep('code');
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    // On success the auth listener swaps this screen for the profile.
    if (verifyError) setError(verifyError.message);
  }

  return (
    <View style={styles.container}>
      {step === 'email' ? (
        <>
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => emailValid && sendCode()}
          />
          <Button title="Email me a sign-in code" onPress={sendCode} disabled={!emailValid} loading={busy} />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            We sent a code to {email.trim()}. It expires in an hour.
          </ThemedText>
          <Field
            label="Code"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={() => codeValid && verifyCode()}
          />
          <Button title="Sign in" onPress={verifyCode} disabled={!codeValid} loading={busy} />
          <View style={styles.row}>
            <Button title="Resend code" variant="secondary" onPress={sendCode} disabled={busy} />
            <Button
              title="Use another email"
              variant="secondary"
              onPress={() => {
                setStep('email');
                setError(null);
              }}
              disabled={busy}
            />
          </View>
        </>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.accent }} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}

      <ThemedView type="backgroundElement" style={styles.providers}>
        <ThemedText type="smallBold">Sign in with Apple, Google or Facebook</ThemedText>
        <View style={styles.providerRow}>
          {(['apple.logo', 'g.circle', 'f.circle'] as const).map((icon) => (
            <SymbolView key={icon} name={icon} size={24} tintColor={theme.textSecondary} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Coming soon. Each provider is switched on once its developer account is set up.
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  providers: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  providerRow: { flexDirection: 'row', gap: Spacing.three },
});

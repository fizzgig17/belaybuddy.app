import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SignInOptions } from '@/components/auth/sign-in-options';
import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Matches otp_length in supabase/config.toml and the hosted projects. */
const CODE_LENGTH = 6;

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

  async function verifyCode(token = code) {
    if (busy || !/^\d{6,10}$/.test(token)) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });
    setBusy(false);
    // On success the auth listener swaps this screen for the profile.
    if (verifyError) setError(verifyError.message);
  }

  // Digits only; sign in as soon as the full code is typed or autofilled,
  // so there's no second tap needed.
  function onCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) verifyCode(digits);
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
          <SignInOptions />
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
            onChangeText={onCodeChange}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={CODE_LENGTH}
            returnKeyType="go"
            onSubmitEditing={() => verifyCode()}
          />
          <Button title="Sign in" onPress={() => verifyCode()} disabled={!codeValid} loading={busy} />
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
});

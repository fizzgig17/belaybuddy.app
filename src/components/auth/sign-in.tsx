import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SignInOptions } from '@/components/auth/sign-in-options';
import { SocialButtons } from '@/components/auth/social-buttons';
import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Matches mailer_otp_length set by the email-templates workflow. */
const CODE_LENGTH = 6;
/** Supabase allows one code email per minute per address. */
const RESEND_SECONDS = 60;
const LAST_EMAIL_KEY = 'bb.lastEmail';
/** App Review account: signs in with a password since reviewers can't read email. */
const DEMO_EMAIL = 'demo@belaybuddy.app';

function loadLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Plain-language versions of the errors people actually hit. */
function friendly(message: string): string {
  if (/expired|invalid/i.test(message)) return "That code didn't work. Check the newest email, or send a new code.";
  if (/rate limit|only request this after|security purposes/i.test(message)) return 'Please wait a minute before asking for another code.';
  return message;
}

/**
 * Passwordless email sign-in: we email a 6-digit code, the user types it in
 * (or iOS fills it from Mail). The same flow creates the account on first use.
 */
export function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<TextInput>(null);
  const [canPaste, setCanPaste] = useState(false);

  // Offer "Paste code" when something's been copied, e.g. after copying the
  // code in Gmail and switching back. Checking doesn't trigger iOS's paste
  // prompt; only reading it (on tap) does.
  useEffect(() => {
    if (step !== 'code' || process.env.EXPO_OS === 'web') return;
    const check = () => Clipboard.hasStringAsync().then(setCanPaste).catch(() => setCanPaste(false));
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [step]);

  async function pasteCode() {
    const text = await Clipboard.getStringAsync().catch(() => '');
    const digits = /\d{6}/.exec(text.replace(/\s/g, ''))?.[0];
    if (digits) onCodeChange(digits);
    else setError("The copied text doesn't contain a 6-digit code.");
  }

  // Prefill the last email used on this device (after mount, for the website).
  useEffect(() => setEmail(loadLastEmail()), []);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const emailValid = EMAIL_PATTERN.test(email.trim());

  async function sendCode() {
    if (!emailValid || busy) return;
    setError(null);
    if (email.trim().toLowerCase() === DEMO_EMAIL) {
      setPassword('');
      setStep('password');
      return;
    }
    setBusy(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) {
      // Show the real reason when it isn't one we recognise, so it can be fixed.
      const code = (sendError as { code?: string }).code;
      setError(friendly(sendError.message) + (code && !/wait a minute/.test(friendly(sendError.message)) ? ` (${code})` : ''));
      return;
    }
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email.trim());
    } catch {
      // Not important.
    }
    setCode('');
    setStep('code');
    setResendIn(RESEND_SECONDS);
  }

  async function signInWithPassword() {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    const { error: pwError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (pwError) {
      setBusy(false);
      setError('That email or password is not right.');
    }
  }

  async function verifyCode(token: string) {
    if (busy || token.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    // On success the auth listener swaps this screen out.
    if (verifyError) {
      setBusy(false);
      setError(friendly(verifyError.message));
      setCode('');
      codeInput.current?.focus();
    }
  }

  function onCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) verifyCode(digits);
  }

  if (step === 'email') {
    return (
      <View style={styles.container}>
        <SocialButtons onError={setError} />
        <Field
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          autoFocus={!email}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={sendCode}
        />
        <Button title="Continue" onPress={sendCode} disabled={!emailValid} loading={busy} />
        {error && <ErrorText text={error} />}
        {emailValid && email.trim().toLowerCase() !== DEMO_EMAIL && (
          // After a refresh or a rate limit you can still use the code already in your inbox.
          <ThemedText
            type="smallBold"
            accessibilityRole="button"
            style={{ color: theme.accent }}
            onPress={() => {
              setError(null);
              setCode('');
              setStep('code');
            }}>
            I already have a code
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          We'll email you a 6-digit code. No password needed. New here? This creates your account.
        </ThemedText>
        <SignInOptions />
      </View>
    );
  }

  if (step === 'password') {
    return (
      <View style={styles.container}>
        <Field
          label={`Password for ${email.trim()}`}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          autoFocus
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={signInWithPassword}
        />
        <Button title="Sign in" onPress={signInWithPassword} disabled={!password} loading={busy} />
        {error && <ErrorText text={error} />}
        <Button title="Back" variant="secondary" onPress={() => setStep('email')} disabled={busy} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.gap1}>
        <ThemedText type="smallBold">Enter the code we emailed you</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Sent to {email.trim()}.{' '}
          <ThemedText
            type="small"
            style={{ color: theme.accent }}
            onPress={() => {
              setStep('email');
              setError(null);
            }}>
            Change
          </ThemedText>
        </ThemedText>
      </View>

      {/* One real input (for typing, pasting and iOS autofill) drawn as six boxes. */}
      <Pressable onPress={() => codeInput.current?.focus()} accessibilityLabel="Sign-in code" style={styles.boxes}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active = i === code.length && !busy;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { backgroundColor: theme.backgroundElement, borderColor: active ? theme.accent : 'transparent' },
              ]}>
              <ThemedText type="subtitle">{code[i] ?? ''}</ThemedText>
            </View>
          );
        })}
        <TextInput
          ref={codeInput}
          value={code}
          onChangeText={onCodeChange}
          autoFocus
          editable={!busy}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          caretHidden
          style={styles.hiddenInput}
        />
      </Pressable>

      {canPaste && !busy && code.length < CODE_LENGTH && (
        <Button title="Paste code" onPress={pasteCode} />
      )}

      {busy ? (
        <View style={styles.signingIn}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            Signing in…
          </ThemedText>
        </View>
      ) : (
        error && <ErrorText text={error} />
      )}

      <Button
        title={resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
        variant="secondary"
        onPress={sendCode}
        disabled={busy || resendIn > 0}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Can't find it? Check spam for an email from Belay Buddy. The code works for an hour.
      </ThemedText>
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <ThemedText type="small" style={{ color: theme.accent }} accessibilityLiveRegion="polite">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  gap1: { gap: Spacing.one },
  boxes: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
  box: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.85,
    borderRadius: Spacing.two,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Covers the boxes so taps, long-press paste and autofill all reach it.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
  signingIn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
});

// "Continue with Apple", "Google" and "Facebook" in the iOS/Android app. The
// website's version is social-auth.web.ts.
//
//   Apple   the system sheet (Face ID), then Supabase checks Apple's token.
//           Works on iPhone/iPad only, and needs the Apple provider switched
//           on in Supabase (see .github/workflows/supabase-auth-providers.yml).
//   Google, Facebook
//           Supabase's sign-in page in a system browser sheet; the app gets the
//           session back through the belaybuddy:// link.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

export type SocialResult = { ok: true } | { ok: false; canceled?: boolean; message: string };

const REDIRECT = 'belaybuddy://auth-callback';

/** Google sign-in is shown only when the build knows Google has been set up. */
export const googleEnabled = process.env.EXPO_PUBLIC_GOOGLE_SIGNIN === '1';

/** Facebook sign-in is shown only when the build knows Facebook has been set up. */
export const facebookEnabled = process.env.EXPO_PUBLIC_FACEBOOK_SIGNIN === '1';

export async function appleAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<SocialResult> {
  try {
    // Apple gets the hash of a one-time value and Supabase gets the value
    // itself, so a stolen token can't be replayed.
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!credential.identityToken) return { ok: false, message: 'Apple did not send a sign-in token. Please try again.' };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce,
    });
    if (error) return { ok: false, message: friendly(error.message, 'Apple') };
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, canceled: true, message: '' };
    return { ok: false, message: 'Apple sign-in did not work. Please try again.' };
  }
}

async function signInWithBrowser(provider: 'google' | 'facebook', name: string): Promise<SocialResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { ok: false, message: friendly(error?.message ?? '', name) };
    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
    if (result.type !== 'success') return { ok: false, canceled: true, message: '' };

    // Supabase returns the session in the link's #fragment (or ?code= with PKCE).
    const url = new URL(result.url.replace('#', result.url.includes('?') ? '&' : '?'));
    const params = url.searchParams;
    if (params.get('error_description')) return { ok: false, message: friendly(params.get('error_description')!, name) };
    const code = params.get('code');
    if (code) {
      const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
      return codeError ? { ok: false, message: friendly(codeError.message, name) } : { ok: true };
    }
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (!access || !refresh) return { ok: false, message: `${name} did not finish signing you in. Please try again.` };
    const { error: sessionError } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    return sessionError ? { ok: false, message: friendly(sessionError.message, name) } : { ok: true };
  } catch {
    return { ok: false, message: `${name} sign-in did not work. Please try again.` };
  }
}

export const signInWithGoogle = () => signInWithBrowser('google', 'Google');
export const signInWithFacebook = () => signInWithBrowser('facebook', 'Facebook');

function friendly(message: string, provider: string): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) return `${provider} sign-in isn't set up yet.`;
  return message || `${provider} sign-in did not work. Please try again.`;
}

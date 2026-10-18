// "Continue with Google" on the website: Supabase's Google sign-in page, then
// back here, where the Supabase client picks the session up from the URL.
// Apple sign-in is app-only for now (the website would need an Apple Services
// ID and key). The app's version is social-auth.ts.
import { supabase } from '@/lib/supabase';

export type SocialResult = { ok: true } | { ok: false; canceled?: boolean; message: string };

/** Google sign-in is shown only when the build knows Google has been set up. */
export const googleEnabled = process.env.EXPO_PUBLIC_GOOGLE_SIGNIN === '1';

export async function appleAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(): Promise<SocialResult> {
  return { ok: false, message: 'Apple sign-in is available in the iPhone app.' };
}

export async function signInWithGoogle(): Promise<SocialResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/' },
  });
  if (error) {
    const notReady = /provider is not enabled|unsupported provider/i.test(error.message);
    return { ok: false, message: notReady ? "Google sign-in isn't set up yet." : error.message };
  }
  // The browser is leaving for Google's page.
  return { ok: true };
}

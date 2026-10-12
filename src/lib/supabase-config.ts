// EXPO_PUBLIC_* variables are inlined at build time from .env (dev) or from
// the CI environment (prod). They must be referenced as literal
// process.env.EXPO_PUBLIC_X expressions for the inlining to work.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.',
  );
}

export const supabaseConfig = {
  url,
  publishableKey,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV === 'prod' ? 'prod' : 'dev',
} as const;

// Native (iOS/Android) Supabase client. Web uses supabase.web.ts.
// Setup follows https://docs.expo.dev/guides/using-supabase/
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { sessionStorageAdapter } from '@/lib/session-prefs';
import { supabaseConfig } from '@/lib/supabase-config';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    // Saved or memory-only, depending on "Keep me signed in".
    storage: sessionStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session token while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

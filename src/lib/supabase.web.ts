// Web Supabase client. Uses localStorage, or sessionStorage when "Keep me
// signed in" is off; during the static
// export (server-side rendering) there is no window, so sessions aren't stored.
import { createClient } from '@supabase/supabase-js';

import { sessionStorageAdapter } from '@/lib/session-prefs';
import { supabaseConfig } from '@/lib/supabase-config';

const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    storage: isBrowser ? sessionStorageAdapter : undefined,
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});

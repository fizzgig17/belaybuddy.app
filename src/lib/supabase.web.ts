// Web Supabase client. Uses the browser's localStorage; during the static
// export (server-side rendering) there is no window, so sessions aren't stored.
import { createClient } from '@supabase/supabase-js';

import { supabaseConfig } from '@/lib/supabase-config';

const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});

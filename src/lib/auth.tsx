import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { unregisterPushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  /** True until the stored session (if any) has been loaded on launch. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Signs out after stopping push notifications to this device. */
export async function signOut() {
  await unregisterPushToken();
  await supabase.auth.signOut();
}

export function useAuth() {
  return useContext(AuthContext);
}

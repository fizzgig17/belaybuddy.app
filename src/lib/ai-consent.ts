import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * Permission to send a Route AI photo to the AI service (Anthropic's Claude). It is saved on the
 * person's profile (profiles.ai_consent), so it follows them across devices, and the route-tips
 * function checks it before every request. "unset" means they haven't been asked yet; "loading"
 * means we haven't heard back from the server yet.
 */
export type AiConsent = 'loading' | 'unset' | 'allowed' | 'denied';

const cache = new Map<string, Exclude<AiConsent, 'loading'>>();
const acks = new Map<string, boolean>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

async function load(userId: string) {
  if (cache.has(userId) || inFlight.has(userId)) return;
  inFlight.add(userId);
  try {
    const { data } = await supabase.from('profiles').select('ai_consent, tips_ack_at').eq('id', userId).maybeSingle();
    const v = data?.ai_consent;
    acks.set(userId, !!data?.tips_ack_at);
    cache.set(userId, v === 'allowed' || v === 'denied' ? v : 'unset');
  } catch {
    cache.set(userId, 'unset');
  } finally {
    inFlight.delete(userId);
    notify();
  }
}

/** The signed-in person's AI choice, and a setter that saves it to their profile. */
export function useAiConsent() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId]);

  const consent = useSyncExternalStore(
    subscribe,
    (): AiConsent => (userId ? (cache.get(userId) ?? 'loading') : 'unset'),
    () => 'loading' as AiConsent,
  );

  const set = useCallback(
    async (value: 'allowed' | 'denied') => {
      if (!userId) return;
      const before = cache.get(userId) ?? 'unset';
      cache.set(userId, value);
      notify();
      const { error } = await supabase
        .from('profiles')
        .update({ ai_consent: value, ai_consent_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) {
        cache.set(userId, before);
        notify();
      }
    },
    [userId],
  );

  const acknowledged = useSyncExternalStore(
    subscribe,
    () => (userId ? (acks.get(userId) ?? false) : false),
    () => false,
  );

  /** Saves that the person understands tips are suggestions and they climb at their own risk. */
  const acknowledge = useCallback(async () => {
    if (!userId) return;
    acks.set(userId, true);
    notify();
    const { error } = await supabase.from('profiles').update({ tips_ack_at: new Date().toISOString() }).eq('id', userId);
    if (error) {
      acks.set(userId, false);
      notify();
    }
  }, [userId]);

  return { consent, set, signedIn: !!userId, acknowledged, acknowledge };
}

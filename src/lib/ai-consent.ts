import { useCallback, useSyncExternalStore } from 'react';

import { useAuth } from '@/lib/auth';

/**
 * Permission to send a Route AI photo to the AI service (Anthropic's Claude), kept per person on
 * this device. "unset" means they haven't been asked yet; we only ask when they first use AI.
 */
export type AiConsent = 'unset' | 'allowed' | 'denied';

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

const keyFor = (userId: string) => `bb.aiConsent.${userId}`;

function read(userId: string | undefined): AiConsent {
  if (!userId) return 'unset';
  const v = storage()?.getItem(keyFor(userId));
  return v === 'allowed' || v === 'denied' ? v : 'unset';
}

export function setAiConsent(userId: string, value: Exclude<AiConsent, 'unset'>) {
  storage()?.setItem(keyFor(userId), value);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The signed-in person's AI choice, and a setter. Signed-out people have no AI features. */
export function useAiConsent() {
  const { user } = useAuth();
  const userId = user?.id;
  const consent = useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => 'unset' as AiConsent,
  );
  const set = useCallback(
    (value: Exclude<AiConsent, 'unset'>) => {
      if (userId) setAiConsent(userId, value);
    },
    [userId],
  );
  return { consent, set, signedIn: !!userId };
}

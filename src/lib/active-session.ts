import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/lib/auth';
import { fetchActiveSession } from '@/lib/climb-log';

// Whether the signed-in person has a climbing session running. The round button in the tab bar reads it.
let active = false;
const listeners = new Set<() => void>();

export function setSessionActive(value: boolean) {
  if (active === value) return;
  active = value;
  listeners.forEach((l) => l());
}

export async function refreshSessionActive() {
  try {
    setSessionActive(!!(await fetchActiveSession()));
  } catch {
    // Keep what we had.
  }
}

export function useSessionActive(): boolean {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (userId) void refreshSessionActive();
    else setSessionActive(false);
  }, [userId]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => active,
    () => false,
  );
}

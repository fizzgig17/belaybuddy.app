import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/lib/auth';
import { deleteClimb, fetchActiveSession, type ClimbLog, type ClimbSession } from '@/lib/climb-log';

// The signed-in person's running climbing session, as far as the round button and the climb beads need it: whether
// one is running, and the climbs logged so far. The record sheet and the strip above the tab bar both read this.
type State = { active: boolean; logs: ClimbLog[] };
let state: State = { active: false, logs: [] };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

/** Call with the session (or null once it has ended) whenever it is loaded or changes. */
export function setActiveSession(s: ClimbSession | null) {
  set(s ? { active: true, logs: s.logs } : { active: false, logs: [] });
}

export function setSessionActive(value: boolean) {
  if (!value) set({ active: false, logs: [] });
  else if (!state.active) set({ ...state, active: true });
}

export async function refreshSessionActive() {
  try {
    setActiveSession(await fetchActiveSession());
  } catch {
    // Keep what we had.
  }
}

/** Removes a logged climb (undo). Throws an Error safe to show. */
export async function removeClimb(id: string) {
  await deleteClimb(id);
  set({ ...state, logs: state.logs.filter((l) => l.id !== id) });
}

/** Puts an edited climb back into the running session's list (the beads redraw). */
export function replaceClimb(updated: ClimbLog) {
  set({ ...state, logs: state.logs.map((l) => (l.id === updated.id ? updated : l)) });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSessionActive(): boolean {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (userId) void refreshSessionActive();
    else setActiveSession(null);
  }, [userId]);
  return useSyncExternalStore(subscribe, () => state.active, () => false);
}

export function useSessionLogs(): ClimbLog[] {
  return useSyncExternalStore(subscribe, () => state.logs, () => state.logs);
}

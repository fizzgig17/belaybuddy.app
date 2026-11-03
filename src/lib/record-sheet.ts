import { useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { setSessionActive } from '@/lib/active-session';
import { endSession, fetchActiveSession, type ClimbSession } from '@/lib/climb-log';
import { checkOut } from '@/lib/friends';

// The record-session sheet: whether it is up, and the summary shown after a session ends.
type State = { open: boolean; finished: ClimbSession | null; tab: 'record' | 'history'; confirmEnd: boolean };
let state: State = { open: false, finished: null, tab: 'record', confirmEnd: false };
let endUserId: string | undefined;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const openRecordSheet = () => set({ open: true });
/** Opens the sheet on its History tab (past sessions). */
export const openHistory = () => set({ open: true, tab: 'history' });
export const setRecordTab = (tab: 'record' | 'history') => set({ tab });
/** Closing also drops the "Nice session" summary. */
export const closeRecordSheet = () => set({ open: false, finished: null, tab: 'record', confirmEnd: false });
export const toggleRecordSheet = () => (state.open ? closeRecordSheet() : openRecordSheet());

export function useRecordSheet(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

async function endNow(userId?: string) {
  try {
    const s = await fetchActiveSession();
    if (!s) {
      setSessionActive(false);
      set({ confirmEnd: false });
      return;
    }
    await endSession(s.id);
    // Ending the session also ends a check-in made for it.
    if (userId) await checkOut(userId).catch(() => {});
    setSessionActive(false);
    // Back to the start screen, ready for the next session.
    set({ open: true, tab: 'record', finished: null, confirmEnd: false });
  } catch (e) {
    set({ confirmEnd: false });
    if (Platform.OS !== 'web') Alert.alert('Could not end the session', (e as Error).message);
  }
}

/** Asks "End this session?" with an in-app pop-up (End session / Keep climbing). The round button calls this. */
export function confirmEndSession(userId?: string) {
  endUserId = userId;
  set({ confirmEnd: true });
}
export const cancelEndSession = () => set({ confirmEnd: false });
export const endSessionNow = () => endNow(endUserId);

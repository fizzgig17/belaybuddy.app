import { useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { setSessionActive } from '@/lib/active-session';
import { endSession, fetchActiveSession, type ClimbSession } from '@/lib/climb-log';
import { checkOut } from '@/lib/friends';

// The record-session sheet: whether it is up, and the summary shown after a session ends.
type State = { open: boolean; finished: ClimbSession | null; tab: 'record' | 'history' };
let state: State = { open: false, finished: null, tab: 'record' };
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
export const closeRecordSheet = () => set({ open: false, finished: null, tab: 'record' });
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
      return;
    }
    await endSession(s.id);
    // Ending the session also ends a check-in made for it.
    if (userId) await checkOut(userId).catch(() => {});
    setSessionActive(false);
    set({ open: true, tab: 'record', finished: { ...s, endedAt: new Date().toISOString() } });
  } catch (e) {
    if (Platform.OS !== 'web') Alert.alert('Could not end the session', (e as Error).message);
  }
}

/** Asks "End this session?" and ends it. The round button calls this. */
export function confirmEndSession(userId?: string) {
  if (Platform.OS === 'web') return void endNow(userId);
  Alert.alert('End this session?', undefined, [
    { text: 'Keep climbing', style: 'cancel' },
    { text: 'End session', style: 'destructive', onPress: () => void endNow(userId) },
  ]);
}

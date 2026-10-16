// "Keep me signed in" and the Face ID lock preference, plus the storage the
// Supabase client keeps its session in.
//
// Keep signed in ON:  the session is saved (localStorage on the web, the
//                     app's SQLite-backed localStorage on iOS/Android).
// Keep signed in OFF: the session lives only until the tab is closed
//                     (sessionStorage) or the app is quit (memory).
//
// Both supabase.ts and supabase.web.ts import this after localStorage exists.

type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const KEEP_KEY = 'bb.keepSignedIn';
const LOCK_KEY = 'bb.biometricLock';

function persistent(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>();
const memoryStore: KV = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

/** Per-tab storage on the web; plain memory in the app. */
function temporary(): KV {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // Some browsers throw when storage is blocked.
  }
  return memoryStore;
}

export function getKeepSignedIn(): boolean {
  return persistent()?.getItem(KEEP_KEY) !== '0';
}

export function getBiometricLock(): boolean {
  return getKeepSignedIn() && persistent()?.getItem(LOCK_KEY) === '1';
}

export function setBiometricLock(on: boolean) {
  persistent()?.setItem(LOCK_KEY, on ? '1' : '0');
}

/** Session keys the Supabase client has written ("sb-<ref>-auth-token"). */
const sessionKeys = new Set<string>();

/**
 * Changes where the session is kept. Moves an existing session across, so
 * this works both before signing in and from Settings afterwards.
 */
export function setKeepSignedIn(keep: boolean) {
  const store = persistent();
  if (!store) return;
  const from = keep ? temporary() : store;
  const to = keep ? store : temporary();
  store.setItem(KEEP_KEY, keep ? '1' : '0');
  if (!keep) setBiometricLock(false);
  for (const key of sessionKeys) {
    const value = from.getItem(key);
    if (value != null) {
      to.setItem(key, value);
      from.removeItem(key);
    }
  }
}

/** Storage adapter for supabase-js `auth.storage`. */
export const sessionStorageAdapter = {
  getItem(key: string) {
    sessionKeys.add(key);
    const store = persistent();
    return getKeepSignedIn() ? (store?.getItem(key) ?? null) : temporary().getItem(key);
  },
  setItem(key: string, value: string) {
    sessionKeys.add(key);
    const store = persistent();
    if (getKeepSignedIn()) {
      store?.setItem(key, value);
      temporary().removeItem(key);
    } else {
      temporary().setItem(key, value);
      store?.removeItem(key);
    }
  },
  removeItem(key: string) {
    persistent()?.removeItem(key);
    temporary().removeItem(key);
  },
};

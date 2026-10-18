// Light, dark or "match my phone", remembered on this device. The website and both
// apps use it through the useColorScheme hook (hooks/use-color-scheme).
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'bb.theme';
const listeners = new Set<() => void>();
let current: ThemePref | null = null;

function read(): ThemePref {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

// Phones also need to be told, so system pieces (alerts, the tab bar) match.
function applyNative(pref: ThemePref) {
  if (Platform.OS === 'web') return;
  try {
    Appearance.setColorScheme(pref === 'system' ? null : pref);
  } catch {
    // Older systems: the in-app colors still follow the choice.
  }
}

// Read lazily: on phones the storage is set up after this file loads.
function get(): ThemePref {
  if (current === null) {
    current = read();
    applyNative(current);
  }
  return current;
}

export function setThemePref(pref: ThemePref) {
  current = pref;
  try {
    if (pref === 'system') globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, pref);
  } catch {
    // Not remembered, still applied for this visit.
  }
  applyNative(pref);
  listeners.forEach((l) => l());
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get,
    () => 'system',
  );
}

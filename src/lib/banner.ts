import { useCallback, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

export type Banner = { message: string; version: number };

const KEY = 'bb.bannerDismissed';

/** The newest banner the person has closed. Kept in the browser's (or app's) local storage. */
function readDismissed(): number {
  try {
    return typeof localStorage !== 'undefined' ? Number(localStorage.getItem(KEY) ?? 0) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeDismissed(version: number) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, String(version));
  } catch {
    // Storage blocked: the banner may show again next visit, which is fine.
  }
}

// One shared copy, so the banner and every screen agree on whether it is showing.
let current: Banner | null = null;
let dismissedVersion = readDismissed();
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded) return;
  loaded = true;
  supabase
    .from('site_banner')
    .select('message, version')
    .eq('active', true)
    .maybeSingle()
    .then(({ data }) => {
      current = data ? { message: data.message as string, version: Number(data.version) } : null;
      emit();
    });
}

function visible(): Banner | null {
  return current && current.version > dismissedVersion ? current : null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => void listeners.delete(l);
}

/**
 * The active site banner, unless this person already closed it. Closing is permanent for that
 * message (until site data is cleared); a newly published message shows again.
 */
export function useBanner() {
  const banner = useSyncExternalStore(subscribe, visible, () => null);
  const dismiss = useCallback(() => {
    if (!current) return;
    dismissedVersion = current.version;
    writeDismissed(current.version);
    emit();
  }, []);
  return { banner, dismiss };
}

export type AdminBanner = { message: string; active: boolean };

export async function fetchAdminBanner(): Promise<AdminBanner | null> {
  const { data, error } = await supabase.rpc('admin_get_banner');
  if (error) throw new Error(/Not allowed/i.test(error.message) ? 'Only admins can do that.' : error.message);
  const row = (data as { message: string; active: boolean }[] | null)?.[0];
  return row ? { message: row.message, active: row.active } : null;
}

export async function publishBanner(message: string) {
  const { error } = await supabase.rpc('admin_set_banner', { p_message: message, p_active: true });
  if (error) throw new Error(error.message);
}

export async function turnOffBanner() {
  const { error } = await supabase.rpc('admin_turn_off_banner');
  if (error) throw new Error(error.message);
}

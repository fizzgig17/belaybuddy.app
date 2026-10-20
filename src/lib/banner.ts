import { useCallback, useEffect, useState } from 'react';

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

/**
 * The active site banner, unless this person already closed it. Closing is permanent for that
 * message (until site data is cleared); a newly published message shows again.
 */
export function useBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let active = true;
    supabase
      .from('site_banner')
      .select('message, version')
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setBanner(data ? { message: data.message as string, version: Number(data.version) } : null);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (!banner) return;
    writeDismissed(banner.version);
    setDismissed(banner.version);
  }, [banner]);

  return { banner: banner && banner.version > dismissed ? banner : null, dismiss };
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

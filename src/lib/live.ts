import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Keeps a screen current without pulling: while it is showing, reload when one of
 * `tables` changes (Supabase Realtime), when the app comes back to the front,
 * and every minute as a backup in case the live connection dropped.
 * `reload` should be quiet (no spinner).
 */
export function useLiveRefresh(tables: string[], reload: () => void, enabled = true) {
  const latest = useRef(reload);
  useEffect(() => {
    latest.current = reload;
  });
  const key = tables.join(',');

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      // Several rows often change together; reload once.
      const soon = () => {
        clearTimeout(timer);
        timer = setTimeout(() => latest.current(), 600);
      };
      let channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2, 8)}`);
      for (const table of key.split(',')) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
      }
      channel.subscribe();
      const state = AppState.addEventListener('change', (s) => {
        if (s === 'active') soon();
      });
      const poll = setInterval(() => latest.current(), 60_000);
      return () => {
        clearTimeout(timer);
        clearInterval(poll);
        state.remove();
        supabase.removeChannel(channel);
      };
    }, [key, enabled]),
  );
}

import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePref } from '@/lib/theme-preference';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const system = useRNColorScheme();
  const pref = useThemePref();
  const scheme = pref === 'system' ? system : pref;

  useEffect(() => {
    // Lets the browser draw scrollbars and form controls to match.
    if (scheme === 'dark' || scheme === 'light') document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  if (hasHydrated) {
    return scheme;
  }

  return 'light';
}

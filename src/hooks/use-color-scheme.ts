import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePref } from '@/lib/theme-preference';

/** The colors to show: the person's choice (see Settings), else the phone's. */
export function useColorScheme() {
  const system = useSystemColorScheme();
  const pref = useThemePref();
  return pref === 'system' ? system : pref;
}

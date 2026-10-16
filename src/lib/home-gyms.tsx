import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { ClimbingArea, HomeGym } from '@/types/models';

type Row = { area_id: string; name: string; latitude: number; longitude: number };

const fromRow = (r: Row): HomeGym => ({
  areaId: r.area_id,
  name: r.name,
  location: { latitude: r.latitude, longitude: r.longitude },
});

type HomeGymsState = {
  homeGyms: HomeGym[];
  loading: boolean;
  isHomeGym: (areaId: string) => boolean;
  /** Adds or removes. Resolves false if the user needs to sign in first. */
  toggle: (gym: ClimbingArea) => Promise<boolean>;
  error: string | null;
};

const HomeGymsContext = createContext<HomeGymsState>({
  homeGyms: [],
  loading: false,
  isHomeGym: () => false,
  toggle: async () => false,
  error: null,
});

/** The gyms whose belay boards the user follows (principle 2: gym first). */
export function HomeGymsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHomeGyms([]);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('home_gyms')
      .select('area_id, name, latitude, longitude')
      .order('created_at')
      .then(({ data, error: e }) => {
        if (!active) return;
        setLoading(false);
        if (e) setError(e.message);
        else setHomeGyms((data as Row[]).map(fromRow));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const ids = useMemo(() => new Set(homeGyms.map((g) => g.areaId)), [homeGyms]);

  const toggle = useCallback(
    async (gym: ClimbingArea) => {
      if (!user) return false;
      setError(null);
      const previous = homeGyms;
      if (ids.has(gym.id)) {
        setHomeGyms(homeGyms.filter((g) => g.areaId !== gym.id));
        const { error: e } = await supabase.from('home_gyms').delete().eq('area_id', gym.id);
        if (e) {
          setHomeGyms(previous);
          setError(e.message);
        }
      } else {
        const row: Row = {
          area_id: gym.id,
          name: gym.name,
          latitude: gym.location.latitude,
          longitude: gym.location.longitude,
        };
        setHomeGyms([...homeGyms, fromRow(row)]);
        const { error: e } = await supabase.from('home_gyms').insert(row);
        if (e) {
          setHomeGyms(previous);
          setError(e.message);
        }
      }
      return true;
    },
    [user, ids, homeGyms],
  );

  const value = useMemo(
    () => ({ homeGyms, loading, isHomeGym: (id: string) => ids.has(id), toggle, error }),
    [homeGyms, loading, ids, toggle, error],
  );
  return <HomeGymsContext.Provider value={value}>{children}</HomeGymsContext.Provider>;
}

export function useHomeGyms() {
  return useContext(HomeGymsContext);
}

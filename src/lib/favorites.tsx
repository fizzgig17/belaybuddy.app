import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { ClimbingArea, Favorite } from '@/types/models';

type FavoriteRow = {
  area_id: string;
  area_kind: Favorite['areaKind'];
  source: Favorite['source'];
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
};

const fromRow = (r: FavoriteRow): Favorite => ({
  areaId: r.area_id,
  areaKind: r.area_kind,
  source: r.source,
  name: r.name,
  location: { latitude: r.latitude, longitude: r.longitude },
  createdAt: r.created_at,
});

/** What can be saved: a gym or crag, or a shop. */
export type Savable = {
  id: string;
  kind: Favorite['areaKind'];
  source: Favorite['source'];
  name: string;
  location: Favorite['location'];
};

type PlaceFavorite = Favorite & { areaKind: ClimbingArea['kind'] };

type FavoritesState = {
  /** Saved gyms and crags. Saved shops are in `savedShops`. */
  favorites: PlaceFavorite[];
  savedShops: Favorite[];
  isFavorite: (areaId: string) => boolean;
  /** Adds or removes. Resolves false if the user needs to sign in first. */
  toggle: (area: Savable) => Promise<boolean>;
  error: string | null;
};

const FavoritesContext = createContext<FavoritesState>({
  favorites: [],
  savedShops: [],
  isFavorite: () => false,
  toggle: async () => false,
  error: null,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    let active = true;
    supabase
      .from('favorites')
      .select('area_id, area_kind, source, name, latitude, longitude, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (!active) return;
        if (e) setError(e.message);
        else setFavorites((data as FavoriteRow[]).map(fromRow));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const ids = useMemo(() => new Set(favorites.map((f) => f.areaId)), [favorites]);

  const toggle = useCallback(
    async (area: Savable) => {
      if (!user) return false;
      setError(null);
      const was = ids.has(area.id);
      const previous = favorites;
      // Optimistic update; roll back if the database refuses.
      if (was) {
        setFavorites(favorites.filter((f) => f.areaId !== area.id));
        const { error: e } = await supabase.from('favorites').delete().eq('area_id', area.id);
        if (e) {
          setFavorites(previous);
          setError(e.message);
        }
      } else {
        const row: FavoriteRow = {
          area_id: area.id,
          area_kind: area.kind,
          source: area.source,
          name: area.name,
          latitude: area.location.latitude,
          longitude: area.location.longitude,
          created_at: new Date().toISOString(),
        };
        setFavorites([fromRow(row), ...favorites]);
        const { created_at: _ignored, ...insert } = row;
        const { error: e } = await supabase.from('favorites').insert({ ...insert, user_id: user.id });
        if (e) {
          setFavorites(previous);
          setError(e.message);
        }
      }
      return true;
    },
    [user, ids, favorites],
  );

  const value = useMemo(
    () => ({
      favorites: favorites.filter((f): f is PlaceFavorite => f.areaKind !== 'shop'),
      savedShops: favorites.filter((f) => f.areaKind === 'shop'),
      isFavorite: (id: string) => ids.has(id),
      toggle,
      error,
    }),
    [favorites, ids, toggle, error],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}

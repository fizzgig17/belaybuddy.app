import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AreaRow } from '@/components/find/area-row';
import { Notice, PlaceSearchBox, usePlaceSearch } from '@/components/find/place-search';
import { AreaRowSkeleton } from '@/components/ui/skeleton';
import { Button, ButtonIcon, Segmented } from '@/components/form';
import { WebIntro } from '@/components/web-intro';
import { CragBanner } from '@/components/illustrations';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadNearby, type NearbyState } from '@/lib/areas';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { distanceKm, milesToKm } from '@/lib/geo';
import type { ClimbingArea, Favorite } from '@/types/models';


type Filter = 'all' | 'gym' | 'crag';
const RADII = [10, 25, 50] as const;
type Radius = (typeof RADII)[number];
const PAGE = 30;

const favoriteToArea = (f: Favorite & { areaKind: ClimbingArea['kind'] }): ClimbingArea => ({
  id: f.areaId,
  kind: f.areaKind,
  name: f.name,
  location: f.location,
  styles: [],
  source: f.source,
  sourceId: f.areaId.slice(f.areaId.indexOf(':') + 1),
});

export default function FindScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { favorites, isFavorite, toggle, error: favoriteError } = useFavorites();

  const search = usePlaceSearch();
  const { place, message, setMessage, locating, locateMe } = search;
  const [result, setResult] = useState<NearbyState | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [radius, setRadius] = useState<Radius>(25);
  const [shown, setShown] = useState(PAGE);
  const [showAllSaved, setShowAllSaved] = useState(false);


  // Load results whenever the location or radius changes. Keyed on the point,
  // not the place object, so filling in the place name doesn't reload.
  const lat = place?.point.latitude;
  const lng = place?.point.longitude;
  useEffect(() => {
    if (lat == null || lng == null) return;
    setShown(PAGE);
    setResult({ areas: [], pending: { gyms: true, crags: true }, errors: {} });
    return loadNearby({ latitude: lat, longitude: lng }, milesToKm(radius), setResult);
  }, [lat, lng, radius]);
  const loading = !!result && result.pending.gyms && result.pending.crags;


  async function onToggleFavorite(area: ClimbingArea) {
    const ok = await toggle(area);
    if (!ok) setMessage('signin');
  }

  const visible = useMemo(
    () => (result?.areas ?? []).filter((a) => filter === 'all' || a.kind === filter),
    [result, filter],
  );
  const savedVisible = showAllSaved ? favorites : favorites.slice(0, 3);
  // Saved spots show once, in the Saved list. When the search below has loaded
  // one of them, use that fuller record so its hours and styles appear too.
  const savedIds = useMemo(() => new Set(user ? savedVisible.map((f) => f.areaId) : []), [user, savedVisible]);
  const listed = useMemo(() => visible.filter((a) => !savedIds.has(a.id)), [visible, savedIds]);

  return (
    <Screen profileButton title="Find" subtitle="Climbing gyms and outdoor crags near you, or wherever you're headed.">
      {!place && <CragBanner />}

      {/* Where to look */}
      <PlaceSearchBox s={search} />


      {message === 'signin' ? (
        <ThemedView type="backgroundElement" style={styles.notice}>
          <ThemedText type="small">Sign in to save favorites.</ThemedText>
          <Link href="/profile" asChild>
            <Pressable accessibilityRole="link">
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Sign in
              </ThemedText>
            </Pressable>
          </Link>
        </ThemedView>
      ) : (
        message && <Notice text={message} />
      )}
      {favoriteError && <Notice text={`Couldn't update favorites: ${favoriteError}`} />}

      {!place && !message && (
        <View style={styles.intro}>
          <Button title="Find climbing near me" icon={<ButtonIcon name="myLocation" />} onPress={locateMe} loading={locating} />
          <ThemedText type="small" themeColor="textSecondary">
            Or search for the place you're headed.
          </ThemedText>
        </View>
      )}

      {Platform.OS === 'web' && !user && !place && <WebIntro />}

      {/* Saved */}
      {user && favorites.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Saved</ThemedText>
          {savedVisible.map((f) => {
            const loaded = result?.areas.find((a) => a.id === f.areaId);
            const area = loaded ?? favoriteToArea(f);
            return (
              <AreaRow
                key={f.areaId}
                area={area}
                hoursKnown={!!loaded}
                distanceKm={place ? distanceKm(place.point, f.location) : undefined}
                favorite
                onToggleFavorite={() => onToggleFavorite(area)}
              />
            );
          })}
          {favorites.length > 3 && (
            <Button
              variant="secondary"
              title={showAllSaved ? 'Show fewer' : `Show all ${favorites.length} saved`}
              onPress={() => setShowAllSaved(!showAllSaved)}
            />
          )}
        </View>
      )}

      {/* Results */}
      {place && (
        <View style={styles.section}>
          <ThemedText type="smallBold">{place.label}</ThemedText>
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'gym', label: 'Gyms' },
              { value: 'crag', label: 'Crags' },
            ]}
          />
          <Segmented
            label="Distance"
            value={radius}
            onChange={setRadius}
            options={RADII.map((r) => ({ value: r, label: `${r} mi` }))}
          />

          {loading ? (
            <AreaRowSkeleton />
          ) : (
            <>
              {result?.errors.gyms && (
                <Notice text="We're still gathering gyms for this area. Check back soon, or try a larger distance." />
              )}
              {result?.errors.crags && (
                <Notice text={`Crags couldn't be loaded right now (${result.errors.crags}). Try again in a minute.`} />
              )}
              {result && (result.pending.gyms || result.pending.crags) && (
                <View style={styles.stillLoading}>
                  <ActivityIndicator size="small" />
                  <ThemedText type="small" themeColor="textSecondary">
                    Still loading {result.pending.gyms ? 'gyms' : 'crags'}…
                  </ThemedText>
                </View>
              )}
              {result && !result.pending.gyms && !result.pending.crags && listed.length === 0 && (
                <ThemedText themeColor="textSecondary">
                  {radius < 50
                    ? `Nothing within ${radius} miles. Try a bigger distance.`
                    : 'Nothing within 50 miles of here yet.'}
                </ThemedText>
              )}
              {listed.slice(0, shown).map((area) => (
                <AreaRow
                  key={area.id}
                  area={area}
                  distanceKm={area.distanceKm}
                  favorite={isFavorite(area.id)}
                  onToggleFavorite={user ? () => onToggleFavorite(area) : undefined}
                />
              ))}
              {listed.length > shown && (
                <Button
                  variant="secondary"
                  title={`Show ${Math.min(PAGE, listed.length - shown)} more`}
                  onPress={() => setShown(shown + PAGE)}
                />
              )}
              {result && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
                  Gym data © OpenStreetMap contributors and Overture Maps Foundation. Crag data from OpenBeta.
                </ThemedText>
              )}
              {result && !result.pending.gyms && !result.pending.crags && <MissingPlaceLink />}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

function MissingPlaceLink() {
  const theme = useTheme();
  return (
    <Link href="/suggest-place" asChild>
      <Pressable accessibilityRole="link" hitSlop={8}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Missing a gym or crag? Tell us
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  intro: { gap: Spacing.two, alignItems: 'stretch' },
  section: { gap: Spacing.two + 4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  stillLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  attribution: { marginTop: Spacing.two },
});

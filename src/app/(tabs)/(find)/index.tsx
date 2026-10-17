import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AreaRow } from '@/components/find/area-row';
import { AreaRowSkeleton } from '@/components/ui/skeleton';
import { loadLastPlace, saveLastPlace } from '@/components/find/storage';
import { Button, Segmented } from '@/components/form';
import { CragBanner } from '@/components/illustrations';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadNearby, type NearbyState } from '@/lib/areas';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { distanceKm, milesToKm } from '@/lib/geo';
import { describePoint, getDeviceLocation, LocationDeniedError, searchPlaces, type Place } from '@/lib/location';
import type { ClimbingArea, Favorite } from '@/types/models';

type Filter = 'all' | 'gym' | 'crag';
const RADII = [10, 25, 50] as const;
type Radius = (typeof RADII)[number];
const PAGE = 30;

const favoriteToArea = (f: Favorite): ClimbingArea => ({
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

  const [place, setPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<NearbyState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [radius, setRadius] = useState<Radius>(25);
  const [shown, setShown] = useState(PAGE);
  const [showAllSaved, setShowAllSaved] = useState(false);

  // Restore the last place after mount (not during render, so the website's
  // pre-rendered HTML matches the first client render).
  useEffect(() => {
    const last = loadLastPlace();
    if (last) setPlace(last);
  }, []);

  const choose = useCallback((p: Place) => {
    setPlace(p);
    setChoices([]);
    setMessage(null);
    saveLastPlace(p);
  }, []);

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

  async function locateMe() {
    setLocating(true);
    setMessage(null);
    try {
      const point = await getDeviceLocation();
      // Start searching right away; name the place once the lookup returns.
      choose({ point, label: 'Near you' });
      describePoint(point).then((name) => {
        if (!name) return;
        setPlace((current) => {
          if (current?.point !== point) return current;
          const named = { point, label: `Near ${name}` };
          saveLastPlace(named);
          return named;
        });
      });
    } catch (e) {
      setMessage(
        e instanceof LocationDeniedError
          ? 'Location is turned off for Belay Buddy. Search for a town or park instead, or allow location in Settings.'
          : `Couldn't get your location: ${(e as Error).message}`,
      );
    } finally {
      setLocating(false);
    }
  }

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLocating(true);
    setMessage(null);
    try {
      const found = await searchPlaces(q);
      if (found.length === 0) setMessage(`No places found for "${q}". Try a town, park or zip code.`);
      else if (found.length === 1) choose(found[0]);
      else setChoices(found);
    } catch (e) {
      setMessage(`Search failed: ${(e as Error).message}`);
    } finally {
      setLocating(false);
    }
  }

  async function onToggleFavorite(area: ClimbingArea) {
    const ok = await toggle(area);
    if (!ok) setMessage('signin');
  }

  const visible = useMemo(
    () => (result?.areas ?? []).filter((a) => filter === 'all' || a.kind === filter),
    [result, filter],
  );
  const savedVisible = showAllSaved ? favorites : favorites.slice(0, 3);

  return (
    <Screen profileButton title="Find" subtitle="Climbing gyms and outdoor crags near you, or wherever you're headed.">
      {!place && <CragBanner />}

      {/* Where to look */}
      <View style={styles.searchRow}>
        <ThemedView type="backgroundElement" style={styles.searchBox}>
          <SymbolView name={Icons.search} size={16} tintColor={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Town, park or zip code"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search for a place"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </ThemedView>
        <Pressable
          onPress={locateMe}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my location"
          style={({ pressed }) => [
            styles.locateButton,
            { backgroundColor: theme.accentSoft },
            pressed && styles.pressed,
          ]}>
          {locating ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <SymbolView name={Icons.myLocation} size={20} tintColor={theme.accent} />
          )}
        </Pressable>
      </View>

      {choices.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.choices}>
          <ThemedText type="smallBold">Which one?</ThemedText>
          {choices.map((c, i) => (
            <Pressable key={`${c.label}-${i}`} onPress={() => choose(c)} accessibilityRole="button">
              <ThemedText style={{ color: theme.accent }}>{c.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

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
          <Button title="Find climbing near me" onPress={locateMe} loading={locating} />
          <ThemedText type="small" themeColor="textSecondary">
            Or search for the place you're headed.
          </ThemedText>
        </View>
      )}

      {/* Saved */}
      {user && favorites.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Saved</ThemedText>
          {savedVisible.map((f) => {
            const area = favoriteToArea(f);
            return (
              <AreaRow
                key={f.areaId}
                area={area}
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
                <Notice text={`Gyms couldn't be loaded right now (${result.errors.gyms}). Try again in a minute.`} />
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
              {result && !result.pending.gyms && !result.pending.crags && visible.length === 0 && (
                <ThemedText themeColor="textSecondary">
                  {radius < 50
                    ? `Nothing within ${radius} miles. Try a bigger distance.`
                    : 'Nothing within 50 miles of here yet.'}
                </ThemedText>
              )}
              {visible.slice(0, shown).map((area) => (
                <AreaRow
                  key={area.id}
                  area={area}
                  distanceKm={area.distanceKm}
                  favorite={isFavorite(area.id)}
                  onToggleFavorite={user ? () => onToggleFavorite(area) : undefined}
                />
              ))}
              {visible.length > shown && (
                <Button
                  variant="secondary"
                  title={`Show ${Math.min(PAGE, visible.length - shown)} more`}
                  onPress={() => setShown(shown + PAGE)}
                />
              )}
              {result && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
                  Gym data © OpenStreetMap contributors. Crag data from OpenBeta. Missing a spot? Both are
                  community-edited and open to updates.
                </ThemedText>
              )}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

function Notice({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.notice} accessibilityLiveRegion="polite">
      <SymbolView name={Icons.warning} size={16} tintColor={theme.textSecondary} />
      <ThemedText type="small" style={styles.noticeText}>
        {text}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two + 4 },
  locateButton: { width: 48, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  choices: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  intro: { gap: Spacing.two, alignItems: 'stretch' },
  section: { gap: Spacing.two + 4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  noticeText: { flex: 1 },
  loading: { marginVertical: Spacing.four },
  stillLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  attribution: { marginTop: Spacing.two },
  pressed: { opacity: 0.7 },
});

import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AreaRow } from '@/components/find/area-row';
import { AreaRowSkeleton } from '@/components/ui/skeleton';
import { loadLastPlace, saveLastPlace } from '@/components/find/storage';
import { Button, ButtonIcon, Segmented } from '@/components/form';
import { WebIntro } from '@/components/web-intro';
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
import { describePoint, getDeviceLocation, LocationDeniedError, searchPlaces, suggestPlaces, type Place } from '@/lib/location';
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
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const picked = useRef(false); // the text was just filled in from a suggestion
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
    setSuggestions([]);
    setMessage(null);
    saveLastPlace(p);
  }, []);

  // Suggest places while typing: after a pause, from three characters, newest answer wins.
  const near = place?.point;
  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3 || /^\d{5}$/.test(q)) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await suggestPlaces(q, controller.signal, near);
      if (!controller.signal.aborted) setSuggestions(found);
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
    Keyboard.dismiss(); // Android keeps its search key busy while the keyboard stays up
    setSuggestions([]);
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
  // Saved spots show once, in the Saved list. When the search below has loaded
  // one of them, use that fuller record so its hours and styles appear too.
  const savedIds = useMemo(() => new Set(user ? savedVisible.map((f) => f.areaId) : []), [user, savedVisible]);
  const listed = useMemo(() => visible.filter((a) => !savedIds.has(a.id)), [visible, savedIds]);

  return (
    <Screen
      profileButton
      title="Find"
      subtitle={
        Platform.OS === 'web' && !user
          ? 'Find where to climb, and who to climb with.'
          : "Climbing gyms and outdoor crags near you, or wherever you're headed."
      }>
      {!place && <CragBanner />}

      {/* Where to look */}
      <View style={styles.searchRow}>
        <ThemedView
          type="backgroundElement"
          style={[styles.searchBox, { borderColor: focused ? theme.accent : 'transparent' }]}>
          <SymbolView name={Icons.search} size={16} tintColor={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Town, park or zip code"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            enterKeyHint="search"
            blurOnSubmit
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            accessibilityLabel="Search for a place"
            style={[
              styles.searchInput,
              { color: theme.text },
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
            ]}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                picked.current = false;
                setQuery('');
                setSuggestions([]);
                setChoices([]);
                setMessage(null);
                inputRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}>
              <SymbolView name={Icons.close} size={16} tintColor={theme.textSecondary} />
            </Pressable>
          )}
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

      {suggestions.length > 0 && choices.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.choices}>
          {suggestions.map((c, i) => (
            <Pressable
              key={`${c.label}-${i}`}
              onPress={() => {
                picked.current = true;
                setQuery(c.label);
                choose(c);
              }}
              accessibilityRole="button">
              <ThemedText style={{ color: theme.accent }}>{c.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

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
                  Missing a spot? These are open data sources that can be updated.
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
    borderWidth: 2,
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

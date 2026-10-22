import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { loadLastPlace, saveLastPlace } from '@/components/find/storage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describePoint, getDeviceLocation, LocationDeniedError, searchPlaces, suggestPlaces, type Place } from '@/lib/location';

/**
 * The "where are you looking?" search shared by Find and Shops: the place is
 * remembered between the two tabs, suggestions appear while typing, and the
 * location button uses the device position.
 */
export function usePlaceSearch() {
  const [place, setPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<Place[]>([]);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const picked = useRef(false); // the text was just filled in from a suggestion
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      if (found.length === 0) setMessage(`No places found for "${q}". Try a town, park, zip code or a place's name.`);
      else if (found.length === 1) choose(found[0]);
      else setChoices(found);
    } catch (e) {
      setMessage(`Search failed: ${(e as Error).message}`);
    } finally {
      setLocating(false);
    }
  }

  return {
    place, setPlace, query, setQuery, choices, setChoices, suggestions, setSuggestions,
    focused, setFocused, inputRef, picked, locating, message, setMessage, choose, locateMe, search,
  };
}

export type PlaceSearch = ReturnType<typeof usePlaceSearch>;

/** The search field, location button, suggestions and "Which one?" list. */
export function PlaceSearchBox({ s }: { s: PlaceSearch }) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.searchRow}>
        <ThemedView
          type="backgroundElement"
          style={[styles.searchBox, { borderColor: s.focused ? theme.accent : 'transparent' }]}>
          <SymbolView name={Icons.search} size={16} tintColor={theme.textSecondary} />
          <TextInput
            ref={s.inputRef}
            onFocus={() => s.setFocused(true)}
            onBlur={() => s.setFocused(false)}
            value={s.query}
            onChangeText={s.setQuery}
            onSubmitEditing={s.search}
            placeholder="Town, park, zip code or name"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            enterKeyHint="search"
            blurOnSubmit
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            accessibilityLabel="Search by town, park, zip code or place name"
            style={[styles.searchInput, { color: theme.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
          {s.query.length > 0 && (
            <Pressable
              onPress={() => {
                s.picked.current = false;
                s.setQuery('');
                s.setSuggestions([]);
                s.setChoices([]);
                s.setMessage(null);
                s.inputRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}>
              <SymbolView name={Icons.close} size={16} tintColor={theme.textSecondary} />
            </Pressable>
          )}
        </ThemedView>
        <Pressable
          onPress={s.locateMe}
          disabled={s.locating}
          accessibilityRole="button"
          accessibilityLabel="Use my location"
          style={({ pressed }) => [styles.locateButton, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
          {s.locating ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <SymbolView name={Icons.myLocation} size={20} tintColor={theme.accent} />
          )}
        </Pressable>
      </View>

      {s.suggestions.length > 0 && s.choices.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.choices}>
          {s.suggestions.map((c, i) => (
            <Pressable
              key={`${c.label}-${i}`}
              onPress={() => {
                s.picked.current = true;
                s.setQuery(c.label);
                s.choose(c);
              }}
              accessibilityRole="button">
              <ThemedText style={{ color: theme.accent }}>{c.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

      {s.choices.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.choices}>
          <ThemedText type="smallBold">Which one?</ThemedText>
          {s.choices.map((c, i) => (
            <Pressable key={`${c.label}-${i}`} onPress={() => s.choose(c)} accessibilityRole="button">
              <ThemedText style={{ color: theme.accent }}>{c.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}
    </>
  );
}

export function Notice({ text }: { text: string }) {
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
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  noticeText: { flex: 1 },
  pressed: { opacity: 0.7 },
});

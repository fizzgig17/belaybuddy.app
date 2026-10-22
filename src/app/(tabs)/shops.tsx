import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Notice, PlaceSearchBox, usePlaceSearch } from '@/components/find/place-search';
import { Button, ButtonIcon, Segmented } from '@/components/form';
import { GymWallBanner } from '@/components/illustrations';
import { SuggestHours } from '@/components/find/suggest-hours';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { IconButton } from '@/components/ui/icon-button';
import { AreaRowSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { directionsUrl, phoneUrl } from '@/lib/areas';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { distanceKm, formatDistance, milesToKm } from '@/lib/geo';
import { hoursSearchUrl, isOpenNow } from '@/lib/hours';
import { tap } from '@/lib/haptics';
import { fetchShops, type Shop } from '@/lib/shops';
import type { Favorite } from '@/types/models';

const RADII = [10, 25, 50] as const;
type Radius = (typeof RADII)[number];

export default function ShopsScreen() {
  const { user } = useAuth();
  const { savedShops, isFavorite, toggle, error: favoriteError } = useFavorites();
  const search = usePlaceSearch();
  const { place, message, setMessage, locating, locateMe } = search;
  const [radius, setRadius] = useState<Radius>(25);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyClimbing, setOnlyClimbing] = useState<'all' | 'climbing'>('all');
  const [showAllSaved, setShowAllSaved] = useState(false);

  const lat = place?.point.latitude;
  const lng = place?.point.longitude;
  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    setShops(null);
    setError(null);
    fetchShops({ latitude: lat, longitude: lng }, milesToKm(radius))
      .then((r) => !cancelled && setShops(r))
      .catch((e: Error) => !cancelled && setError(`Couldn't load shops (${e.message}). Try again in a moment.`));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, radius]);

  async function onToggle(shop: Pick<Shop, 'id' | 'name' | 'location'>) {
    const ok = await toggle({ id: shop.id, kind: 'shop', source: 'osm', name: shop.name, location: shop.location });
    if (!ok) setMessage('signin');
  }

  const visible = (shops ?? []).filter((s) => onlyClimbing === 'all' || s.climbing);
  const savedShown = showAllSaved ? savedShops : savedShops.slice(0, 3);
  // Saved shops show once, in the Saved list, using the fuller record when this search has loaded it.
  const savedIds = useMemo(() => new Set(user ? savedShown.map((f) => f.areaId) : []), [user, savedShown]);
  const listed = visible.filter((s) => !savedIds.has(s.id));

  const snapshot = (f: Favorite): Shop => ({
    id: f.areaId,
    name: f.name,
    location: f.location,
    climbing: false,
    distanceKm: place ? distanceKm(place.point, f.location) : 0,
  });

  return (
    <Screen
      profileButton
      title="Shops"
      subtitle="Climbing shops and outdoor stores that carry gear. Call ahead to check stock.">
      <PlaceSearchBox s={search} />

      {message === 'signin' ? (
        <SignInNotice />
      ) : (
        message && <Notice text={message} />
      )}
      {favoriteError && <Notice text={`Couldn't update favorites: ${favoriteError}`} />}

      {!place ? (
        <>
          <GymWallBanner />
          {!message && (
            <>
              <Button title="Find shops near me" icon={<ButtonIcon name="myLocation" />} onPress={locateMe} loading={locating} />
              <ThemedText type="small" themeColor="textSecondary">
                Or search for the place you're headed.
              </ThemedText>
            </>
          )}
        </>
      ) : (
        <>
          <Segmented
            label="Distance"
            value={radius}
            onChange={setRadius}
            options={RADII.map((r) => ({ value: r, label: `${r} mi` }))}
          />
          <Segmented
            label="Which shops"
            value={onlyClimbing}
            onChange={setOnlyClimbing}
            options={[
              { value: 'all', label: 'All gear stores' },
              { value: 'climbing', label: 'Climbing shops' },
            ]}
          />
        </>
      )}

      {user && savedShops.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Saved</ThemedText>
          {savedShown.map((f) => {
            const loaded = shops?.find((s) => s.id === f.areaId);
            return (
              <ShopRow
                key={f.areaId}
                shop={loaded ?? snapshot(f)}
                detailsKnown={!!loaded}
                showDistance={!!place}
                saved
                onToggle={() => onToggle(loaded ?? snapshot(f))}
              />
            );
          })}
          {savedShops.length > 3 && (
            <Button
              variant="secondary"
              title={showAllSaved ? 'Show fewer' : `Show all ${savedShops.length} saved`}
              onPress={() => setShowAllSaved(!showAllSaved)}
            />
          )}
        </View>
      )}

      {place && (
        <View style={styles.section}>
          <ThemedText type="smallBold">{place.label}</ThemedText>
          {error && <ThemedText type="small" themeColor="textSecondary">{error}</ThemedText>}
          {shops === null && !error && <AreaRowSkeleton />}
          {shops && listed.length === 0 && (
            <ThemedText themeColor="textSecondary">
              {onlyClimbing === 'climbing' && shops.length > 0
                ? 'No shops tagged as climbing stores here. Try “All gear stores”.'
                : visible.length > 0
                  ? 'The only shops here are in your saved list.'
                  : 'No shops found in this area. Try a bigger distance.'}
            </ThemedText>
          )}
          {listed.slice(0, 40).map((shop) => (
            <ShopRow
              key={shop.id}
              shop={shop}
              detailsKnown
              showDistance
              saved={isFavorite(shop.id)}
              onToggle={user ? () => onToggle(shop) : undefined}
            />
          ))}
          {shops && (
            <ThemedText type="small" themeColor="textSecondary">
              Shop data © OpenStreetMap contributors.
            </ThemedText>
          )}
          {shops && <MissingShopLink />}
        </View>
      )}
    </Screen>
  );
}

function MissingShopLink() {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/suggest-place', params: { kind: 'shop' } }} asChild>
      <Pressable accessibilityRole="link" hitSlop={8}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Missing a shop? Tell us
        </ThemedText>
      </Pressable>
    </Link>
  );
}

function SignInNotice() {
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.push('/profile')} accessibilityRole="link">
      <Card style={styles.signin}>
        <ThemedText type="small" style={styles.flex}>
          Sign in to save favorites.
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Sign in
        </ThemedText>
      </Card>
    </Pressable>
  );
}

/** One shop: details on top, a row of round icon buttons below. */
function ShopRow({
  shop,
  detailsKnown,
  showDistance,
  saved,
  onToggle,
}: {
  shop: Shop;
  /** False for a saved shop that this search hasn't loaded: only its name and directions are known. */
  detailsKnown: boolean;
  showDistance: boolean;
  saved: boolean;
  /** Omit when signed out: the star is hidden. */
  onToggle?: () => void;
}) {
  const theme = useTheme();
  const open = detailsKnown ? isOpenNow(shop.openingHours) : null;
  const noHours = detailsKnown && !shop.openingHours;
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: `${HoldColors.coral}26` }]}>
          <SymbolView name={Icons.shop} size={20} tintColor={HoldColors.coral} />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={styles.flex} numberOfLines={2}>
              {shop.name}
            </ThemedText>
            {showDistance && (
              <ThemedText type="small" themeColor="textSecondary">
                {formatDistance(shop.distanceKm)}
              </ThemedText>
            )}
          </View>
          {shop.address && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {shop.address}
            </ThemedText>
          )}
          {detailsKnown && (
            <View style={styles.chips}>
              {shop.climbing && (
                <View style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText type="small" style={[styles.chipText, { color: theme.accent }]}>
                    Climbing gear
                  </ThemedText>
                </View>
              )}
              <View style={[styles.chip, { backgroundColor: open ? `${HoldColors.green}26` : theme.backgroundElement }]}>
                <ThemedText
                  type="small"
                  style={[styles.chipText, { color: open ? HoldColors.green : theme.textSecondary }]}>
                  {open === null ? 'Hours not listed' : open ? 'Open now' : 'Closed now'}
                </ThemedText>
              </View>
            </View>
          )}
        </View>
        {onToggle && (
          <Pressable
            onPress={() => {
              tap();
              onToggle();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? `Remove ${shop.name} from favorites` : `Save ${shop.name} to favorites`}
            accessibilityState={{ selected: saved }}
            style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
            <SymbolView
              name={saved ? Icons.favoriteOn : Icons.favorite}
              size={22}
              tintColor={saved ? HoldColors.yellow : theme.textSecondary}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.actions}>
        <IconButton tipAbove icon="directions" label="Directions" onPress={() => Linking.openURL(directionsUrl(shop))} />
        {shop.phone && <IconButton tipAbove icon="phone" label="Call" onPress={() => Linking.openURL(phoneUrl(shop.phone!))} />}
        {shop.website && <IconButton tipAbove icon="website" label="Website" onPress={() => Linking.openURL(shop.website!)} />}
        {noHours && (
          <IconButton
            tipAbove
            icon="search"
            label="Look up hours online"
            onPress={() => Linking.openURL(hoursSearchUrl(shop.name, shop.address))}
          />
        )}
        {noHours && <SuggestHours compact place={{ id: shop.id, name: shop.name, kind: 'shop' }} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.two + 4 },
  signin: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  card: { gap: Spacing.three },
  top: { flexDirection: 'row', gap: Spacing.three },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2, marginTop: Spacing.one },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
  star: { padding: Spacing.one },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three },
});

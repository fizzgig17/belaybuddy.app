import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { loadLastPlace, saveLastPlace } from '@/components/find/storage';
import { Button, Segmented } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { AreaRowSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { directionsUrl, phoneUrl } from '@/lib/areas';
import { formatDistance, milesToKm } from '@/lib/geo';
import { isOpenNow } from '@/lib/hours';
import { describePoint, getDeviceLocation, LocationDeniedError, type Place } from '@/lib/location';
import { fetchShops, type Shop } from '@/lib/shops';

const RADII = [10, 25, 50] as const;
type Radius = (typeof RADII)[number];

export default function ShopsScreen() {
  const [place, setPlace] = useState<Place | null>(null);
  const [radius, setRadius] = useState<Radius>(25);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [onlyClimbing, setOnlyClimbing] = useState<'all' | 'climbing'>('all');

  // Same place as the Find tab, if you've searched there.
  useEffect(() => {
    const last = loadLastPlace();
    if (last) setPlace(last);
  }, []);

  const lat = place?.point.latitude;
  const lng = place?.point.longitude;
  const load = useCallback(() => {
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
  useEffect(() => load(), [load]);

  async function locateMe() {
    setLocating(true);
    setError(null);
    try {
      const point = await getDeviceLocation();
      const here = { point, label: 'Near you' };
      setPlace(here);
      saveLastPlace(here);
      describePoint(point).then((name) => name && setPlace({ point, label: `Near ${name}` }));
    } catch (e) {
      setError(
        e instanceof LocationDeniedError
          ? 'Location is turned off for Belay Buddy. Search for a place on the Find tab, or allow location in Settings.'
          : `Couldn't get your location: ${(e as Error).message}`,
      );
    } finally {
      setLocating(false);
    }
  }

  const visible = (shops ?? []).filter((s) => onlyClimbing === 'all' || s.climbing);

  return (
    <Screen
      profileButton
      title="Shops"
      subtitle="Climbing shops and outdoor stores that carry gear. Call ahead to check stock.">
      {!place ? (
        <Button title="Find shops near me" onPress={locateMe} loading={locating} />
      ) : (
        <>
          <View style={styles.where}>
            <ThemedText type="smallBold" style={styles.flex}>
              {place.label}
            </ThemedText>
            <Pressable onPress={locateMe} hitSlop={8} accessibilityRole="button">
              <ThemedText type="small" themeColor="textSecondary">
                {locating ? 'Locating…' : 'Use my location'}
              </ThemedText>
            </Pressable>
          </View>
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

      {error && <ThemedText type="small" themeColor="textSecondary">{error}</ThemedText>}
      {place && shops === null && !error && <AreaRowSkeleton />}
      {shops && visible.length === 0 && (
        <ThemedText themeColor="textSecondary">
          {onlyClimbing === 'climbing' && shops.length > 0
            ? 'No shops tagged as climbing stores here. Try “All gear stores”.'
            : 'No shops found in this area. Try a bigger distance.'}
        </ThemedText>
      )}
      {visible.slice(0, 40).map((shop) => (
        <ShopRow key={shop.id} shop={shop} />
      ))}
      {shops && (
        <ThemedText type="small" themeColor="textSecondary">
          Shop data © OpenStreetMap contributors. Missing a shop? It can be added at openstreetmap.org.
        </ThemedText>
      )}
    </Screen>
  );
}

function ShopRow({ shop }: { shop: Shop }) {
  const theme = useTheme();
  const open = isOpenNow(shop.openingHours);
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
            <ThemedText type="small" themeColor="textSecondary">
              {formatDistance(shop.distanceKm)}
            </ThemedText>
          </View>
          {shop.address && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {shop.address}
            </ThemedText>
          )}
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
        </View>
      </View>
      <View style={styles.actions}>
        <Button title="Directions" variant="secondary" onPress={() => Linking.openURL(directionsUrl(shop))} />
        {(shop.phone || shop.website) && (
          <View style={styles.actionRow}>
            {shop.phone && (
              <View style={styles.flex}>
                <Button title="Call" variant="secondary" onPress={() => Linking.openURL(phoneUrl(shop.phone!))} />
              </View>
            )}
            {shop.website && (
              <View style={styles.flex}>
                <Button title="Website" variant="secondary" onPress={() => Linking.openURL(shop.website!)} />
              </View>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  where: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  card: { gap: Spacing.three },
  top: { flexDirection: 'row', gap: Spacing.three },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2, marginTop: Spacing.one },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
  actions: { gap: Spacing.two },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
});

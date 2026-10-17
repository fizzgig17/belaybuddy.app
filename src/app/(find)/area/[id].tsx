import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { CragBanner, GymWallBanner } from '@/components/illustrations';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { areaSlug, directionsUrl, editUrl, fetchAreaBySlug, phoneUrl, sourceUrl } from '@/lib/areas';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { useHomeGyms } from '@/lib/home-gyms';
import { formatOpeningHours } from '@/lib/hours';
import type { ClimbingArea } from '@/types/models';

function kindLabel(area: ClimbingArea) {
  if (area.kind === 'gym') {
    if (area.styles.length === 1 && area.styles[0] === 'bouldering') return 'Bouldering gym';
    return 'Climbing gym';
  }
  return area.styles.includes('bouldering') ? 'Bouldering area' : 'Outdoor crag';
}

const STYLE_LABELS: Record<string, string> = {
  bouldering: 'Bouldering',
  'top-rope': 'Top rope',
  lead: 'Lead',
};

export default function AreaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const homeGyms = useHomeGyms();
  const [area, setArea] = useState<ClimbingArea | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    let active = true;
    setState('loading');
    fetchAreaBySlug(id)
      .then((a) => {
        if (!active) return;
        setArea(a);
        setState(a ? 'ready' : 'missing');
      })
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [id]);

  if (state !== 'ready' || !area) {
    return (
      <Screen title="Details" showTitle={false}>
        <Stack.Screen options={{ title: '' }} />
        {state === 'loading' && <ActivityIndicator style={styles.loading} />}
        {state === 'missing' && <ThemedText>This place couldn't be found. It may have been removed.</ThemedText>}
        {state === 'error' && (
          <ThemedText>Couldn't load this place right now. Check your connection and try again.</ThemedText>
        )}
      </Screen>
    );
  }

  const saved = isFavorite(area.id);
  const hours = area.openingHours ? formatOpeningHours(area.openingHours) : null;
  const details = sourceUrl(area);
  const fix = editUrl(area);
  const styleLabels = area.styles.map((s) => STYLE_LABELS[s]).filter(Boolean);

  return (
    <Screen title={area.name} showTitle={false}>
      <Stack.Screen options={{ title: area.kind === 'gym' ? 'Gym' : 'Crag' }} />
      {area.kind === 'gym' ? <GymWallBanner /> : <CragBanner />}

      <View style={styles.heading}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {area.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {kindLabel(area)}
          {area.kind === 'crag' && area.region ? ` in ${area.region}` : ''}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <View style={styles.primary}>
          <Button title="Directions" onPress={() => Linking.openURL(directionsUrl(area))} />
        </View>
        {user && (
        <Pressable
          onPress={async () => setNeedsSignIn(!(await toggle(area)))}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from favorites' : 'Save to favorites'}
          accessibilityState={{ selected: saved }}
          style={({ pressed }) => [styles.save, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
          <SymbolView
            name={saved ? Icons.favoriteOn : Icons.favorite}
            size={22}
            tintColor={saved ? HoldColors.yellow : theme.text}
          />
          <ThemedText type="smallBold">{saved ? 'Saved' : 'Save'}</ThemedText>
        </Pressable>
        )}
      </View>
      {user && area.kind === 'gym' && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => homeGyms.toggle(area)}
            accessibilityRole="button"
            accessibilityState={{ selected: homeGyms.isHomeGym(area.id) }}
            style={({ pressed }) => [styles.save, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <SymbolView
              name={homeGyms.isHomeGym(area.id) ? Icons.homeOn : Icons.home}
              size={20}
              tintColor={homeGyms.isHomeGym(area.id) ? theme.accent : theme.text}
            />
            <ThemedText type="smallBold">{homeGyms.isHomeGym(area.id) ? 'Home gym' : 'Set as home gym'}</ThemedText>
          </Pressable>
          <View style={styles.primary}>
            <Button
              title="Belay board"
              variant="secondary"
              onPress={() => router.push({ pathname: '/partners', params: {
                  gym: areaSlug(area.id),
                  name: area.name,
                  lat: String(area.location.latitude),
                  lng: String(area.location.longitude),
                },
              })}
            />
          </View>
        </View>
      )}
      {homeGyms.error && <ThemedText type="small">Couldn't update home gyms: {homeGyms.error}</ThemedText>}
      {needsSignIn && (
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
      )}

      <Card style={styles.card}>
        {area.address && <InfoRow label="Address" value={area.address} />}
        {area.kind === 'gym' && (
          <View style={styles.infoRow}>
            <ThemedText type="smallBold">Hours</ThemedText>
            {hours ? (
              hours.map((h) => (
                <View key={h.days} style={styles.hoursRow}>
                  <ThemedText type="small" style={styles.hoursDays}>
                    {h.days}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.hoursTimes}>
                    {h.hours}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {area.openingHours ?? 'Not listed. Check the gym’s website or call ahead.'}
              </ThemedText>
            )}
          </View>
        )}
        {area.phone && (
          <LinkRow label="Phone" value={area.phone} onPress={() => Linking.openURL(phoneUrl(area.phone!))} />
        )}
        {area.website && (
          <LinkRow
            label="Website"
            value={area.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            onPress={() => Linking.openURL(area.website!)}
          />
        )}
        {styleLabels.length > 0 && <InfoRow label="Climbing" value={styleLabels.join(', ')} />}
        {area.kind === 'crag' && area.climbCount != null && (
          <InfoRow
            label={area.styles.includes('bouldering') ? 'Problems' : 'Routes'}
            value={String(area.climbCount)}
          />
        )}
        {area.kind === 'crag' && area.path && area.path.length > 0 && (
          <InfoRow label="Location" value={area.path.join(' › ')} />
        )}
      </Card>

      {area.kind === 'crag' && details && (
        <Button
          variant="secondary"
          title="See routes and grades on OpenBeta"
          onPress={() => Linking.openURL(details)}
        />
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {area.source === 'osm'
          ? 'Gym details come from OpenStreetMap, which anyone can update. '
          : 'Crag details come from OpenBeta, the open climbing database. '}
        {fix && (
          <ThemedText type="small" style={{ color: theme.accent }} onPress={() => Linking.openURL(fix)}>
            Suggest a fix
          </ThemedText>
        )}
      </ThemedText>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

function LinkRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" style={{ color: theme.accent }}>
        {value}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: Spacing.five },
  heading: { gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  primary: { flex: 1 },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    minHeight: 48,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  infoRow: { gap: Spacing.half },
  hoursRow: { flexDirection: 'row', gap: Spacing.three },
  hoursDays: { width: 96 },
  hoursTimes: { flex: 1 },
  pressed: { opacity: 0.7 },
});

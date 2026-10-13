import { SymbolView } from 'expo-symbols';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { directionsUrl, sourceUrl } from '@/lib/areas';
import { formatDistance } from '@/lib/geo';
import type { ClimbingArea } from '@/types/models';

type Props = {
  area: ClimbingArea;
  distanceKm?: number;
  favorite: boolean;
  onToggleFavorite: () => void;
};

function describe(area: ClimbingArea): string {
  if (area.kind === 'gym') {
    const kind = area.styles.length === 1 && area.styles[0] === 'bouldering' ? 'Bouldering gym' : 'Climbing gym';
    return area.address ? `${kind}, ${area.address}` : kind;
  }
  const what = area.styles.includes('bouldering') ? 'problems' : 'routes';
  const count = area.climbCount ? `${area.climbCount} ${area.climbCount === 1 ? what.slice(0, -1) : what}` : 'Crag';
  return area.region ? `${count} in ${area.region}` : count;
}

export function AreaRow({ area, distanceKm, favorite, onToggleFavorite }: Props) {
  const theme = useTheme();
  // Gyms and crags get their own hold color so the list scans at a glance.
  const tint = area.kind === 'gym' ? HoldColors.purple : HoldColors.green;
  const details = sourceUrl(area);

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={[styles.badge, { backgroundColor: `${tint}26` }]}>
        <SymbolView name={area.kind === 'gym' ? Icons.gym : Icons.crag} size={20} tintColor={tint} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" style={styles.name} numberOfLines={2}>
            {area.name}
          </ThemedText>
          {distanceKm != null && (
            <ThemedText type="small" themeColor="textSecondary">
              {formatDistance(distanceKm)}
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {describe(area)}
        </ThemedText>

        <View style={styles.actions}>
          <Action label="Directions" icon={Icons.directions} onPress={() => Linking.openURL(directionsUrl(area))} />
          {area.website && (
            <Action label="Website" icon={Icons.website} onPress={() => Linking.openURL(area.website!)} />
          )}
          {details && (
            <Action
              label={area.source === 'openbeta' ? 'Routes' : 'Details'}
              icon={Icons.external}
              onPress={() => Linking.openURL(details)}
            />
          )}
        </View>
      </View>

      <Pressable
        onPress={onToggleFavorite}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${area.name} from favorites` : `Save ${area.name} to favorites`}
        accessibilityState={{ selected: favorite }}
        style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
        <SymbolView
          name={favorite ? Icons.favoriteOn : Icons.favorite}
          size={22}
          tintColor={favorite ? HoldColors.yellow : theme.textSecondary}
        />
      </Pressable>
    </ThemedView>
  );
}

function Action({ label, icon, onPress }: { label: string; icon: (typeof Icons)[keyof typeof Icons]; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <SymbolView name={icon} size={14} tintColor={theme.accent} />
      <ThemedText type="small" style={{ color: theme.accent }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  name: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one, marginTop: Spacing.one },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  star: { padding: Spacing.one },
  pressed: { opacity: 0.6 },
});

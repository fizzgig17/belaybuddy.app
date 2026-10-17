import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { isOpenNow } from '@/lib/hours';
import { areaSlug } from '@/lib/areas';
import { formatDistance } from '@/lib/geo';
import type { ClimbingArea } from '@/types/models';

type Props = {
  area: ClimbingArea;
  distanceKm?: number;
  favorite: boolean;
  /** Omit when signed out: the star is hidden. */
  onToggleFavorite?: () => void;
};

const STYLE_CHIP = { bouldering: 'Bouldering', 'top-rope': 'Top rope', lead: 'Lead' } as const;

function describe(area: ClimbingArea): string {
  if (area.kind === 'gym') {
    const kind =
      area.styles.length === 1 && area.styles[0] === 'bouldering' ? 'Bouldering gym' : 'Climbing gym';
    return area.address ? `${kind}, ${area.address}` : kind;
  }
  const what = area.styles.includes('bouldering') ? 'problems' : 'routes';
  const count = area.climbCount
    ? `${area.climbCount} ${area.climbCount === 1 ? what.slice(0, -1) : what}`
    : 'Crag';
  return area.region ? `${count} in ${area.region}` : count;
}

/** One gym or crag in a list. Tapping opens its detail screen. */
export function AreaRow({ area, distanceKm, favorite, onToggleFavorite }: Props) {
  const theme = useTheme();
  // Gyms and crags get their own hold color so the list scans at a glance.
  const tint = area.kind === 'gym' ? HoldColors.purple : HoldColors.green;
  const open = area.kind === 'gym' ? isOpenNow(area.openingHours) : null;
  const chips = area.styles
    .filter((x) => x === 'bouldering' || x === 'top-rope' || x === 'lead')
    .map((x) => STYLE_CHIP[x as 'bouldering' | 'top-rope' | 'lead']);

  return (
    <Card style={styles.row}>
      {/* Plain Pressable + router.push: Link asChild drops function styles,
          which collapsed this row's layout. */}
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({
            pathname: '/area/[id]',
            params: { id: areaSlug(area.id) },
          })
        }
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
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
          {(area.kind === 'gym' || chips.length > 0) && (
            <View style={styles.chips}>
              {area.kind === 'gym' && (
                <View style={[styles.chip, { backgroundColor: open ? `${HoldColors.green}26` : theme.backgroundElement }]}>
                  <ThemedText
                    type="small"
                    style={[styles.chipText, { color: open ? HoldColors.green : theme.textSecondary }]}>
                    {open === null ? 'Hours not listed' : open ? 'Open now' : 'Closed now'}
                  </ThemedText>
                </View>
              )}
              {chips.map((c) => (
                <View key={c} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.chipText}>
                    {c}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>

      {onToggleFavorite && (
        <Pressable
          onPress={() => {
            tap();
            onToggleFavorite();
          }}
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
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    gap: 0,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  name: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2, marginTop: Spacing.one },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
  star: { padding: Spacing.two },
  pressed: { opacity: 0.6 },
});

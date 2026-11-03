import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BeadSkin, shade } from '@/components/record/materials';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { removeClimb } from '@/lib/active-session';
import { colorHex, RESULT_LABELS, ROUTE_COLORS, type ClimbLog } from '@/lib/climb-log';

/** Dark or light text for a bead, whichever reads better on its color. */
function textOn(hex: string | null, fallback: string): string {
  if (!hex) return fallback;
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1F2D35' : '#FFFFFF';
}

function Bead({ log, selected, onPress }: { log: ClimbLog; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const hex = colorHex(log.color);
  const attempt = log.result === 'attempt';
  const flash = log.result === 'flash';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${log.grade}, ${RESULT_LABELS[log.result]}${log.color ? `, ${log.color}` : ''}. Tap for details`}
      hitSlop={4}
      style={[
        styles.bead,
        {
          shadowColor: shade(hex ?? '#888888', -0.6),
          borderColor: selected ? theme.accent : flash ? HoldColors.yellow : attempt ? theme.textSecondary : 'transparent',
          borderWidth: selected || flash ? 3 : attempt ? 1.5 : 0,
          borderStyle: attempt && !selected ? 'dashed' : 'solid',
          opacity: attempt && !selected ? 0.6 : 1,
        },
      ]}>
      <BeadSkin color={hex ?? '#B8C2C8'} size={42} />
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[styles.grade, { color: textOn(hex, theme.text) }]}>
        {log.grade}
      </ThemedText>
    </Pressable>
  );
}

/**
 * The climbs of the session as beads, oldest to newest, with the grade on each: solid = sent, gold ring = flash,
 * dashed and faded = attempt. Tap one for its details (and Remove); the X closes the details.
 */
export function ClimbBeads({ logs, pill }: { logs: ClimbLog[]; pill?: boolean }) {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const picked = logs.find((l) => l.id === openId) ?? null;

  useEffect(() => {
    // Keep the newest bead in view as climbs are added.
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [logs.length]);

  async function remove(l: ClimbLog) {
    try {
      await removeClimb(l.id);
      setOpenId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function confirmRemove(l: ClimbLog) {
    if (Platform.OS === 'web') return void remove(l);
    Alert.alert(`Remove ${l.grade}?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove(l) },
    ]);
  }

  if (logs.length === 0) return null;
  const colorLabel = ROUTE_COLORS.find((c) => c.key === picked?.color)?.label;
  return (
    <View style={styles.wrap}>
      {picked && (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardText}>
            <ThemedText type="smallBold">
              {picked.grade} · {RESULT_LABELS[picked.result]}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {[colorLabel ? `${colorLabel} hold` : '', picked.routeName, picked.discipline === 'boulder' ? 'Boulder' : 'Route', new Date(picked.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            {error && <ThemedText type="small" style={{ color: '#C0392B' }}>{error}</ThemedText>}
          </View>
          <Pressable onPress={() => confirmRemove(picked)} accessibilityRole="button" accessibilityLabel={`Remove ${picked.grade}`} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>Remove</ThemedText>
          </Pressable>
          <IconButton icon="close" label="Close details" onPress={() => { setOpenId(null); setError(null); }} />
        </View>
      )}
      <View style={[styles.rail, pill && { backgroundColor: theme.surface + 'EE', borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beads} keyboardShouldPersistTaps="handled">
          {logs.map((l) => (
            <Bead key={l.id} log={l} selected={l.id === openId} onPress={() => { setError(null); setOpenId(l.id === openId ? null : l.id); }} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, alignItems: 'stretch' },
  rail: { borderRadius: 999, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  beads: { gap: Spacing.two, alignItems: 'center', paddingHorizontal: Spacing.one },
  bead: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 3, elevation: 3, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  grade: { fontSize: 13, lineHeight: 16, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Spacing.three, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three },
  cardText: { flex: 1, gap: 2 },
});

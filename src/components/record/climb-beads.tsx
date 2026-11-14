import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BeadSkin, shade } from '@/components/record/materials';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ClimbEditor } from '@/components/record/climb-edit';
import { removeClimb, replaceClimb } from '@/lib/active-session';
import { colorHex, colorLabel as nameOfColor, RESULT_LABELS, type ClimbLog } from '@/lib/climb-log';

/** Dark or light text for a bead, whichever reads better on its color. */
function textOn(hex: string | null, fallback: string): string {
  if (!hex) return fallback;
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1F2D35' : '#FFFFFF';
}

/** One climb as a glossy bead with its grade. Flash gets a small gold star; an attempt is faded. */
export function ClimbBead({
  log,
  size = 42,
  selected = false,
  onPress,
}: {
  log: ClimbLog;
  size?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const hex = colorHex(log.color);
  const attempt = log.result === 'attempt';
  const flash = log.result === 'flash';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={`${log.grade}, ${RESULT_LABELS[log.result]}${log.color ? `, ${log.color}` : ''}`}
      hitSlop={4}
      style={[
        styles.bead,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: shade(hex ?? '#888888', -0.6),
          shadowOpacity: selected ? 0.55 : 0.35,
          shadowRadius: selected ? 6 : 3,
          opacity: attempt ? 0.6 : 1,
          transform: [{ scale: selected ? 1.14 : 1 }],
        },
      ]}>
      <BeadSkin color={hex ?? '#B8C2C8'} size={size} />
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[styles.grade, { color: textOn(hex, theme.text) }]}>
        {log.grade}
      </ThemedText>
      {flash && <ThemedText style={styles.star}>★</ThemedText>}
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
  const [editing, setEditing] = useState<ClimbLog | null>(null);
  const scroller = useRef<ScrollView>(null);
  const picked = logs.find((l) => l.id === openId) ?? null;
  const fade = useRef(new Animated.Value(1)).current;

  // The details fade away by themselves after about 5 seconds.
  useEffect(() => {
    if (!openId) return;
    fade.stopAnimation();
    fade.setValue(1);
    if (editing) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, fade, editing]);

  /** Fade the details out, then clear them. */
  function dismiss() {
    Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        setOpenId(null);
        setError(null);
      }
    });
  }

  useEffect(() => {
    // Keep the newest bead in view as climbs are added.
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [logs.length]);

  async function remove(l: ClimbLog) {
    try {
      await removeClimb(l.id);
      dismiss();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function confirmRemove(l: ClimbLog) {
    if (Platform.OS === 'web') return void remove(l);
    Alert.alert(`Delete ${l.grade}?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(l) },
    ]);
  }

  if (logs.length === 0) return null;
  const colorLabel = nameOfColor(picked?.color);
  return (
    <View style={styles.wrap}>
      <ClimbEditor log={editing} onClose={() => setEditing(null)} onSaved={replaceClimb} />
      {picked && (
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              backgroundColor: shade(colorHex(picked.color) ?? '#B8C2C8', 0.82),
              borderColor: shade(colorHex(picked.color) ?? '#B8C2C8', -0.05),
            },
          ]}>
          <ClimbBead log={picked} size={38} />
          <View style={styles.cardText}>
            <ThemedText type="smallBold" style={styles.dark}>
              {picked.grade} · {RESULT_LABELS[picked.result]}
            </ThemedText>
            <ThemedText type="small" numberOfLines={2} style={styles.darkSoft}>
              {[colorLabel ? `${colorLabel} hold` : '', picked.routeName, picked.wallHeight ? `${picked.wallHeight} ft` : '', picked.discipline === 'boulder' ? 'Boulder' : 'Route', new Date(picked.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            {error && <ThemedText type="small" style={{ color: '#C0392B' }}>{error}</ThemedText>}
          </View>
          <IconButton icon="edit" label={`Edit ${picked.grade}`} onPress={() => setEditing(picked)} />
          <IconButton icon="trash" label={`Delete ${picked.grade}`} onPress={() => confirmRemove(picked)} />
          <IconButton icon="close" label="Close details" onPress={dismiss} />
        </Animated.View>
      )}
      <View style={[styles.rail, pill && { backgroundColor: theme.surface + 'EE', borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beads} keyboardShouldPersistTaps="handled">
          {logs.map((l) => (
            <ClimbBead key={l.id} log={l} selected={l.id === openId} onPress={() => { setError(null); if (l.id === openId) dismiss(); else setOpenId(l.id); }} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, alignItems: 'stretch' },
  rail: { borderRadius: 999, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  beads: { gap: Spacing.two, alignItems: 'center', paddingHorizontal: Spacing.two, paddingVertical: 10 },
  dark: { color: '#1F2D35' },
  darkSoft: { color: '#3E4F58' },
  star: { position: 'absolute', top: -5, right: -3, fontSize: 15, lineHeight: 17, color: '#F2B705', textShadowColor: '#7A5A00', textShadowRadius: 2 },
  bead: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 3, elevation: 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  grade: { fontSize: 13, lineHeight: 16, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Spacing.three, borderWidth: 1.5, padding: Spacing.two },
  cardText: { flex: 1, gap: 2 },
});

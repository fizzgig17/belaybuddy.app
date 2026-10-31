import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Hold } from '@/lib/route-ai/detect';
import { outlinePath } from '@/lib/route-ai/segment';

const MAX_ZOOM = 8;

type Props = {
  visible: boolean;
  uri: string;
  /** Photo size, only the shape matters. */
  photoWidth: number;
  photoHeight: number;
  holds: Hold[];
  /** Whether a color has been picked yet; before that a tap picks the color. */
  hasColor: boolean;
  busy: boolean;
  /** A tap on the photo, as 0..1 from the left and top. */
  onTap: (nx: number, ny: number) => void;
  /** Removes the holds inside a box (0..1 coordinates) and says how many went. */
  onRemoveBox: (x0: number, y0: number, x1: number, y1: number) => number;
  onPickAnotherColor: () => void;
  onClose: () => void;
};

/**
 * The photo on the whole screen: pinch to zoom, drag to move, tap a hold to remove or add it, and a Box mode
 * where dragging draws a box that removes every hold inside it.
 */
export function HoldEditor({
  visible,
  uri,
  photoWidth,
  photoHeight,
  holds,
  hasColor,
  busy,
  onTap,
  onRemoveBox,
  onPickAnotherColor,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        {visible && (
          <Editor
            uri={uri}
            photoWidth={photoWidth}
            photoHeight={photoHeight}
            holds={holds}
            hasColor={hasColor}
            busy={busy}
            onTap={onTap}
            onRemoveBox={onRemoveBox}
            onPickAnotherColor={onPickAnotherColor}
            onClose={onClose}
          />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Editor({ uri, photoWidth, photoHeight, holds, hasColor, busy, onTap, onRemoveBox, onPickAnotherColor, onClose }: Omit<Props, 'visible'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [boxMode, setBoxMode] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Outlines keep their thickness on screen as the photo grows.
  const [shownScale, setShownScale] = useState(1);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s0 = useSharedValue(1);
  const tx0 = useSharedValue(0);
  const ty0 = useSharedValue(0);
  const fx0 = useSharedValue(0);
  const fy0 = useSharedValue(0);
  const boxOn = useSharedValue(0);
  const bx0 = useSharedValue(0);
  const by0 = useSharedValue(0);
  const bx1 = useSharedValue(0);
  const by1 = useSharedValue(0);

  const aspect = photoWidth / photoHeight;
  const cw = size.w;
  const ch = size.h;
  const bw = cw > 0 ? Math.min(cw, ch * aspect) : 0;
  const bh = aspect > 0 ? bw / aspect : 0;

  const resetView = useCallback(() => {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    setShownScale(1);
  }, [scale, tx, ty]);

  /** A point on screen (relative to the photo area) as 0..1 on the photo. */
  const toPhoto = useCallback(
    (px: number, py: number): [number, number] => {
      const s = scale.value;
      return [((px - cw / 2 - tx.value) / s + bw / 2) / bw, ((py - ch / 2 - ty.value) / s + bh / 2) / bh];
    },
    [scale, tx, ty, cw, ch, bw, bh],
  );

  const tapped = useCallback(
    (px: number, py: number) => {
      if (bw <= 0) return;
      const [nx, ny] = toPhoto(px, py);
      if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return;
      setNote(null);
      onTap(nx, ny);
    },
    [toPhoto, bw, onTap],
  );

  const boxed = useCallback(
    (ax: number, ay: number, bx: number, by: number) => {
      if (bw <= 0) return;
      const [x0, y0] = toPhoto(Math.min(ax, bx), Math.min(ay, by));
      const [x1, y1] = toPhoto(Math.max(ax, bx), Math.max(ay, by));
      const gone = onRemoveBox(x0, y0, x1, y1);
      setNote(gone === 0 ? 'No holds in that box.' : `Removed ${gone} ${gone === 1 ? 'hold' : 'holds'}.`);
    },
    [toPhoto, bw, onRemoveBox],
  );

  const gesture = useMemo(() => {
    const clampT = (t: number, s: number, base: number, view: number) => {
      'worklet';
      const m = Math.max(0, (base * s - view) / 2) + 60;
      return Math.min(m, Math.max(-m, t));
    };
    const pinch = Gesture.Pinch()
      .onStart((e) => {
        s0.value = scale.value;
        tx0.value = tx.value;
        ty0.value = ty.value;
        fx0.value = e.focalX - cw / 2;
        fy0.value = e.focalY - ch / 2;
      })
      .onUpdate((e) => {
        const s = Math.min(MAX_ZOOM, Math.max(1, s0.value * e.scale));
        const k = s / s0.value;
        const fx = e.focalX - cw / 2;
        const fy = e.focalY - ch / 2;
        tx.value = clampT(fx - (fx0.value - tx0.value) * k, s, bw, cw);
        ty.value = clampT(fy - (fy0.value - ty0.value) * k, s, bh, ch);
        scale.value = s;
      })
      .onEnd(() => {
        scheduleOnRN(setShownScale, scale.value);
      });

    const move = Gesture.Pan()
      .maxPointers(1)
      .minDistance(6)
      .enabled(!boxMode)
      .onStart(() => {
        tx0.value = tx.value;
        ty0.value = ty.value;
      })
      .onUpdate((e) => {
        tx.value = clampT(tx0.value + e.translationX, scale.value, bw, cw);
        ty.value = clampT(ty0.value + e.translationY, scale.value, bh, ch);
      });

    const box = Gesture.Pan()
      .maxPointers(1)
      .minDistance(4)
      .enabled(boxMode)
      .onStart((e) => {
        bx0.value = e.x;
        by0.value = e.y;
        bx1.value = e.x;
        by1.value = e.y;
        boxOn.value = 1;
      })
      .onUpdate((e) => {
        bx1.value = e.x;
        by1.value = e.y;
      })
      .onEnd(() => {
        boxOn.value = 0;
        scheduleOnRN(boxed, bx0.value, by0.value, bx1.value, by1.value);
      })
      .onFinalize(() => {
        boxOn.value = 0;
      });

    const tap = Gesture.Tap()
      .maxDistance(10)
      .onEnd((e, success) => {
        if (success) scheduleOnRN(tapped, e.x, e.y);
      });

    return Gesture.Race(tap, Gesture.Simultaneous(pinch, move, box));
  }, [boxMode, cw, ch, bw, bh, boxed, tapped, scale, tx, ty, s0, tx0, ty0, fx0, fy0, bx0, by0, bx1, by1, boxOn]);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const boxStyle = useAnimatedStyle(() => ({
    opacity: boxOn.value,
    left: Math.min(bx0.value, bx1.value),
    top: Math.min(by0.value, by1.value),
    width: Math.abs(bx1.value - bx0.value),
    height: Math.abs(by1.value - by0.value),
  }));

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const line = 1 / shownScale;
  const pad = 5 * line;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <ThemedText type="smallBold" style={styles.light}>
          {!hasColor ? 'Tap one hold on your route' : busy ? 'Updating…' : `${holds.length} ${holds.length === 1 ? 'hold' : 'holds'}`}
        </ThemedText>
        <Pill label="Done" onPress={onClose} primary />
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.area} onLayout={onLayout}>
          {bw > 0 && (
            <Animated.View style={[{ width: bw, height: bh }, photoStyle]}>
              <Image source={{ uri }} style={{ width: bw, height: bh }} />
              <Svg width={bw} height={bh} style={StyleSheet.absoluteFill} pointerEvents="none">
                {holds.map((h) =>
                  h.outline ? (
                    <Path key={`o${h.id}`} d={outlinePath(h.outline, bw, bh)} fill="none" stroke="#FFFFFF" strokeWidth={4.5 * line} strokeLinejoin="round" strokeLinecap="round" />
                  ) : (
                    <Rect
                      key={`o${h.id}`}
                      x={(h.x - h.w / 2) * bw - pad}
                      y={(h.y - h.h / 2) * bh - pad}
                      width={h.w * bw + pad * 2}
                      height={h.h * bh + pad * 2}
                      rx={8 * line}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={4.5 * line}
                      strokeDasharray={h.manual ? `${6 * line} ${4 * line}` : undefined}
                    />
                  ),
                )}
                {holds.map((h) =>
                  h.outline ? (
                    <Path key={`i${h.id}`} d={outlinePath(h.outline, bw, bh)} fill="none" stroke={theme.accent} strokeWidth={2.5 * line} strokeLinejoin="round" strokeLinecap="round" />
                  ) : (
                    <Rect
                      key={`i${h.id}`}
                      x={(h.x - h.w / 2) * bw - pad}
                      y={(h.y - h.h / 2) * bh - pad}
                      width={h.w * bw + pad * 2}
                      height={h.h * bh + pad * 2}
                      rx={8 * line}
                      fill="none"
                      stroke={theme.accent}
                      strokeWidth={2.5 * line}
                      strokeDasharray={h.manual ? `${6 * line} ${4 * line}` : undefined}
                    />
                  ),
                )}
              </Svg>
            </Animated.View>
          )}
          <Animated.View pointerEvents="none" style={[styles.box, boxStyle]} />
        </View>
      </GestureDetector>

      <View style={styles.hintWrap}>
        <ThemedText type="small" style={styles.hint}>
          {note ??
            (!hasColor
              ? 'Pinch to zoom, drag to move. Tap one hold on your route to pick its color.'
              : boxMode
                ? 'Drag a box around holds to remove them. Pinch still zooms.'
                : 'Pinch to zoom, drag to move. Tap a hold to remove it, or tap a missed one to add it.')}
        </ThemedText>
      </View>

      <View style={styles.bar}>
        <Pill label="Reset view" onPress={resetView} />
        {hasColor && <Pill label={boxMode ? 'Box: on' : 'Box remove'} onPress={() => { setNote(null); setBoxMode(!boxMode); }} active={boxMode} />}
        {hasColor && (
          <Pill
            label="Pick color"
            onPress={() => {
              setBoxMode(false);
              resetView();
              onPickAnotherColor();
            }}
          />
        )}
      </View>
    </View>
  );
}

function Pill({ label, onPress, primary, active }: { label: string; onPress: () => void; primary?: boolean; active?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: primary || active ? theme.accent : 'rgba(255,255,255,0.16)' },
        pressed && { opacity: 0.7 },
      ]}>
      <ThemedText type="smallBold" style={styles.light}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.three },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  light: { color: '#FFFFFF' },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#FF5A4D', borderStyle: 'dashed', backgroundColor: 'rgba(255,90,77,0.2)' },
  hintWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  hint: { color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
});

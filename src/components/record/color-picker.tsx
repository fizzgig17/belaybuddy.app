import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { colorHex, isHexColor, ROUTE_COLORS } from '@/lib/climb-log';
import { tap } from '@/lib/haptics';

type Hsv = { h: number; s: number; v: number };

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase();
}

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

const HUES = [0, 60, 120, 180, 240, 300, 360].map((h) => hsvToHex({ h: h % 360, s: 1, v: 1 }));
const THUMB = 26;
const TRACK = 14;

/** A draggable bar with a gradient track. `value` runs from 0 to 1. */
function Slider({
  label,
  value,
  onChange,
  colors,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colors: string[];
  step?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const latest = useRef({ value, onChange, width });
  latest.current = { value, onChange, width };
  const start = useRef(0);
  const id = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the drag when the sheet around it is a scroll view.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { width: w, onChange: change } = latest.current;
        if (!w) return;
        const v = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        start.current = v;
        change(v);
      },
      onPanResponderMove: (_e, g) => {
        const { width: w, onChange: change } = latest.current;
        if (!w) return;
        change(Math.max(0, Math.min(1, start.current + g.dx / w)));
      },
    }),
  ).current;

  const x = Math.max(0, Math.min(width, value * width));
  return (
    <View style={styles.sliderRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sliderLabel}>
        {label}
      </ThemedText>
      <View
        {...responder.panHandlers}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
          onChange(Math.max(0, Math.min(1, value + dir * step)));
        }}
        style={styles.sliderHit}>
        <Svg width="100%" height={TRACK} style={styles.track} pointerEvents="none">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              {colors.map((c, i) => (
                <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={TRACK} rx={TRACK / 2} fill={`url(#${id})`} />
        </Svg>
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: x - THUMB / 2, borderColor: theme.text, backgroundColor: theme.background }]}
        />
      </View>
    </View>
  );
}

/**
 * Hold color: the listed colors as swatches, plus a rainbow swatch that opens a color picker (hue, saturation,
 * brightness, or a typed #RRGGBB) for a color that is not on the list. `value` is a list key or "#RRGGBB".
 */
export function ColorPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const theme = useTheme();
  const custom = isHexColor(value);
  const [open, setOpen] = useState(custom);
  const [hsv, setHsv] = useState<Hsv>(() => (custom ? hexToHsv(value) : { h: 200, s: 0.7, v: 0.8 }));
  const [text, setText] = useState(custom ? value.toUpperCase() : '');
  // Arrows at the ends of the color row: left until it is scrolled all the way left, right until all the way right.
  // The scroll position is kept in a ref and the screen only redraws when an arrow appears or goes away, not on every
  // scroll event.
  const row = useRef<ScrollView>(null);
  const size = useRef({ x: 0, content: 0, view: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const { x, content, view } = size.current;
    const left = x > 2;
    const right = content > 0 && content - view - x > 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  const nudge = (dir: 1 | -1) => {
    tap();
    const { x, content, view } = size.current;
    const max = Math.max(0, content - view);
    row.current?.scrollTo({ x: Math.max(0, Math.min(max, x + dir * view * 0.7)), animated: true });
  };

  // Another color was chosen elsewhere (a scan, a swatch): follow it.
  useEffect(() => {
    if (isHexColor(value)) {
      setHsv(hexToHsv(value));
      setText(value.toUpperCase());
    }
  }, [value]);

  function setFromHsv(next: Hsv) {
    setHsv(next);
    const hex = hsvToHex(next);
    setText(hex);
    onChange(hex);
  }
  function typed(t: string) {
    const clean = ('#' + t.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)).toUpperCase();
    setText(clean);
    if (clean.length === 7) {
      setHsv(hexToHsv(clean));
      onChange(clean);
    }
  }
  function openCustom() {
    tap();
    if (open && custom) return setOpen(false);
    setOpen(true);
    if (!custom) {
      // Start from the listed color already chosen, if there is one.
      const from = colorHex(value);
      const next = from ? hexToHsv(from) : hsv;
      setFromHsv(next);
    }
  }

  const hex = hsvToHex(hsv);
  return (
    <View style={styles.wrap}>
      <View>
        <ScrollView
          ref={row}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.swatches}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(e) => {
            size.current.x = e.nativeEvent.contentOffset.x;
            measure();
          }}
          onContentSizeChange={(w) => {
            size.current.content = w;
            measure();
          }}
          onLayout={(e) => {
            size.current.view = e.nativeEvent.layout.width;
            measure();
          }}
          accessibilityLabel="Route color">
          {ROUTE_COLORS.map((c) => {
            const on = c.key === value;
            return (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityLabel={`${c.label} route`}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  onChange(on ? null : c.key);
                }}
                style={[styles.swatchRing, { borderColor: on ? theme.accent : 'transparent' }]}>
                <View style={[styles.swatch, { backgroundColor: c.hex, borderColor: theme.border }]} />
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pick another color"
            accessibilityState={{ selected: custom, expanded: open }}
            onPress={openCustom}
            style={[styles.swatchRing, { borderColor: custom ? theme.accent : 'transparent' }]}>
            <View style={[styles.swatch, { borderColor: theme.border, backgroundColor: custom ? hex : 'transparent' }]}>
              {!custom && (
                <Svg width={28} height={28}>
                  <Defs>
                    <LinearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
                      {HUES.map((c, i) => (
                        <Stop key={i} offset={i / (HUES.length - 1)} stopColor={c} />
                      ))}
                    </LinearGradient>
                  </Defs>
                  <Circle cx={14} cy={14} r={14} fill="url(#rainbow)" />
                  <Rect x={13} y={7} width={2} height={14} fill="#FFFFFF" />
                  <Rect x={7} y={13} width={14} height={2} fill="#FFFFFF" />
                </Svg>
              )}
            </View>
          </Pressable>
        </ScrollView>
        {edges.left && (
          <Pressable
            onPress={() => nudge(-1)}
            accessibilityRole="button"
            accessibilityLabel="Show earlier colors"
            hitSlop={6}
            style={[styles.arrow, styles.arrowLeft, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={styles.arrowGlyph}>‹</ThemedText>
          </Pressable>
        )}
        {edges.right && (
          <Pressable
            onPress={() => nudge(1)}
            accessibilityRole="button"
            accessibilityLabel="Show more colors"
            hitSlop={6}
            style={[styles.arrow, styles.arrowRight, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={styles.arrowGlyph}>›</ThemedText>
          </Pressable>
        )}
      </View>
      {open && (
        <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.previewRow}>
            <View style={[styles.preview, { backgroundColor: hex, borderColor: theme.border }]} />
            <TextInput
              value={text}
              onChangeText={typed}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              placeholder="#RRGGBB"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Hex color"
              style={[styles.hex, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
          </View>
          <Slider label="Color" value={hsv.h / 360} colors={HUES} onChange={(v) => setFromHsv({ ...hsv, h: Math.min(359.9, v * 360) })} />
          <Slider
            label="Strength"
            value={hsv.s}
            colors={[hsvToHex({ ...hsv, s: 0 }), hsvToHex({ ...hsv, s: 1 })]}
            onChange={(v) => setFromHsv({ ...hsv, s: v })}
          />
          <Slider
            label="Light"
            value={hsv.v}
            colors={['#000000', hsvToHex({ ...hsv, v: 1 })]}
            onChange={(v) => setFromHsv({ ...hsv, v })}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  swatches: { gap: Spacing.two, paddingVertical: 2, alignItems: 'center' },
  swatchRing: { padding: 3, borderRadius: 999, borderWidth: 2 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  arrow: { position: 'absolute', top: 6, width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
  arrowGlyph: { fontSize: 20, lineHeight: 22, textAlign: 'center', includeFontPadding: false },
  arrowLeft: { left: 0 },
  arrowRight: { right: 0 },
  panel: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  preview: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  hex: { flex: 1, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sliderLabel: { width: 56 },
  sliderHit: { flex: 1, height: THUMB + 10, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, top: (THUMB + 10 - TRACK) / 2 },
  thumb: { position: 'absolute', top: 5, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
});

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TILE = 144;
// A fixed scatter of flecks, so the grain is identical on every surface and every render.
const FLECKS = Array.from({ length: 110 }, (_, i) => {
  const f = (v: number) => v - Math.floor(v);
  return {
    x: f(Math.sin(i * 12.9898 + 1.3) * 43758.5453) * TILE,
    y: f(Math.sin(i * 78.233 + 4.1) * 12543.1234) * TILE,
    r: 0.35 + f(Math.sin(i * 39.346 + 2.7) * 9871.337) * 0.75,
    light: f(Math.sin(i * 5.17 + 0.9) * 3571.7) > 0.45,
  };
});

/**
 * Granite speckle: tiny cool-gray flecks at a few percent strength. Lay it first inside a surface; it never takes
 * touches. `radius` rounds its corners to match a card.
 */
export function Grain({ radius = 0, strength = 1, shade = false }: { radius?: number; strength?: number; shade?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const light = dark ? '#C9DDE0' : '#FFFFFF';
  const shadow = dark ? '#000000' : '#2C4A4F';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={dark ? '#FFFFFF' : '#FFFFFF'} stopOpacity={dark ? 0.07 : 0.7} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="1" stopColor={dark ? '#000000' : '#0E2A2E'} stopOpacity={dark ? 0.18 : 0.05} />
          </LinearGradient>
          <Pattern id="granite" x="0" y="0" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            {FLECKS.map((f, i) => (
              <Circle
                key={i}
                cx={f.x}
                cy={f.y}
                r={f.r}
                fill={f.light ? light : shadow}
                opacity={(f.light ? (dark ? 0.14 : 0.75) : dark ? 0.35 : 0.13) * strength}
              />
            ))}
          </Pattern>
        </Defs>
        {shade && <Rect x="0" y="0" width="100%" height="100%" fill="url(#shade)" />}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#granite)" />
      </Svg>
    </View>
  );
}

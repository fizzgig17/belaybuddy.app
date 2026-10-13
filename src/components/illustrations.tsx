/**
 * Original illustrations for screen banners. Drawn in SVG so they're sharp at
 * any size, tiny to ship, and recolor themselves for light and dark mode.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { HoldColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const W = 360;
const H = 150;

/** A climbing-hold-shaped blob: an irregular closed curve around (cx, cy). */
function holdPath(cx: number, cy: number, r: number, seed: number, points = 7) {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + seed;
    // Deterministic wobble so the art is identical on every render.
    const wobble = 0.72 + 0.28 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    pts.push([cx + Math.cos(a) * r * wobble * 1.15, cy + Math.sin(a) * r * wobble * 0.85]);
  }
  // Smooth closed curve through the points (Catmull-Rom converted to cubic Béziers).
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function Frame({ children, label, style }: { children: React.ReactNode; label: string; style?: ViewStyle }) {
  return (
    <View
      style={[styles.frame, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {children}
      </Svg>
    </View>
  );
}

/** Outdoor crag: a granite face with cracks, layered ridges and pines. */
export function CragBanner({ style }: { style?: ViewStyle }) {
  const dark = useColorScheme() === 'dark';
  const sky = dark ? ['#1B2C35', '#2C4652'] : ['#CFE6E4', '#F2F5EE'];
  const farRidge = dark ? '#24363F' : '#A9C3C0';
  const nearRidge = dark ? '#2D434D' : '#7FA39F';
  const rock = dark ? '#3B4F59' : '#8A9A9C';
  const rockShade = dark ? '#2C3D46' : '#6E7F82';
  const crack = dark ? '#1E2C33' : '#4E5E62';
  const pine = dark ? '#16302A' : '#2F5D4C';
  const ground = dark ? '#1A2A26' : '#5C7F64';

  return (
    <Frame label="Illustration of an outdoor climbing crag with pine trees" style={style}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="1" stopColor={sky[1]} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#sky)" />
      <Circle cx={292} cy={38} r={16} fill={HoldColors.yellow} opacity={dark ? 0.75 : 0.9} />
      <Path d="M0,104 L48,72 L92,90 L140,58 L190,84 L240,62 L290,88 L360,66 L360,150 L0,150Z" fill={farRidge} />
      <Path d="M0,120 L60,98 L120,112 L170,96 L230,116 L300,100 L360,112 L360,150 L0,150Z" fill={nearRidge} />
      {/* The crag: a tall face with a shaded side and crack systems. */}
      <Path d="M118,150 L132,52 L150,30 L196,24 L222,40 L238,150Z" fill={rock} />
      <Path d="M196,24 L222,40 L238,150 L206,150 L204,70Z" fill={rockShade} />
      <Path d="M160,36 L156,64 L162,92 L158,124 L161,150" stroke={crack} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M182,30 L186,58 L180,80 L184,106" stroke={crack} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Path d="M138,90 L150,96 L146,110" stroke={crack} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {/* A rope running up the crack line, in rope teal. */}
      <Path d="M161,150 C163,128 155,112 160,92 C164,74 154,62 158,44" stroke={dark ? '#46B8BD' : '#0E7A80'} strokeWidth={2} fill="none" />
      <G fill={pine}>
        {[
          [26, 150, 34],
          [52, 150, 46],
          [78, 150, 30],
          [262, 150, 40],
          [290, 150, 54],
          [322, 150, 36],
          [346, 150, 44],
        ].map(([x, y, h]) => (
          <Path key={x} d={`M${x},${y - h} L${x + h * 0.32},${y - 4} L${x - h * 0.32},${y - 4}Z`} />
        ))}
      </G>
      <Rect x={0} y={144} width={W} height={6} fill={ground} />
    </Frame>
  );
}

/** Gym wall: plywood panels, bolt holes, and a yellow-taped route among other holds. */
export function GymWallBanner({ style }: { style?: ViewStyle }) {
  const dark = useColorScheme() === 'dark';
  const panel = dark ? '#22323A' : '#E9ECE4';
  const panelAlt = dark ? '#26373F' : '#E2E6DD';
  const seam = dark ? '#1A262C' : '#CDD3CA';
  const bolt = dark ? '#3A4C55' : '#B8C0B6';
  const chalk = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)';
  const routeLine = dark ? '#46B8BD' : '#0E7A80';

  // The taped route: yellow holds climbing left to right.
  const route: [number, number, number][] = [
    [44, 126, 12],
    [86, 100, 9],
    [124, 110, 10],
    [156, 78, 9],
    [200, 68, 12],
    [232, 44, 9],
    [272, 34, 10],
    [312, 20, 12],
  ];
  const others: [number, number, number, string][] = [
    [28, 62, 10, HoldColors.coral],
    [72, 30, 8, HoldColors.purple],
    [106, 58, 11, HoldColors.green],
    [178, 122, 10, HoldColors.coral],
    [218, 112, 8, HoldColors.blue],
    [252, 92, 11, HoldColors.green],
    [296, 76, 9, HoldColors.purple],
    [334, 106, 10, HoldColors.blue],
    [142, 26, 8, HoldColors.coral],
    [338, 52, 8, HoldColors.green],
    [104, 138, 7, HoldColors.purple],
  ];

  return (
    <Frame label="Illustration of a climbing gym wall with a route marked in yellow" style={style}>
      <Rect width={W} height={H} fill={panel} />
      {[0, 1, 2, 3].map((i) => (
        <Rect key={i} x={i * 90} y={0} width={90} height={H} fill={i % 2 ? panelAlt : panel} />
      ))}
      {[90, 180, 270].map((x) => (
        <Rect key={x} x={x - 0.5} y={0} width={1} height={H} fill={seam} />
      ))}
      <Rect x={0} y={74.5} width={W} height={1} fill={seam} />
      {/* Bolt holes on a grid, like real T-nuts. */}
      <G fill={bolt}>
        {Array.from({ length: 12 }, (_, col) =>
          Array.from({ length: 5 }, (_, row) => (
            <Circle key={`${col}-${row}`} cx={15 + col * 30} cy={15 + row * 30} r={1.3} />
          )),
        )}
      </G>
      {/* Faint chalk on the most-used holds. */}
      {route.slice(0, 5).map(([x, y, r]) => (
        <Circle key={`c${x}`} cx={x + 3} cy={y + 1} r={r * 1.4} fill={chalk} />
      ))}
      {others.map(([x, y, r, c], i) => (
        <Path key={`o${i}`} d={holdPath(x, y, r, i * 1.7 + 0.4)} fill={c} opacity={dark ? 0.8 : 0.9} />
      ))}
      {/* The route traced the way Route AI maps it. */}
      <Path
        d={'M' + route.map(([x, y]) => `${x},${y}`).join(' L')}
        stroke={routeLine}
        strokeWidth={2}
        strokeDasharray="2 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {route.map(([x, y, r], i) => (
        <G key={`r${i}`}>
          <Path d={holdPath(x, y, r, i * 2.3 + 1.1)} fill={HoldColors.yellow} stroke={dark ? '#141E23' : '#FFFFFF'} strokeWidth={1.5} />
          {/* Route tape under the start and finish holds. */}
          {(i === 0 || i === route.length - 1) && (
            <Rect x={x - 10} y={y + r + 3} width={20} height={4} rx={1} fill={HoldColors.yellow} />
          )}
        </G>
      ))}
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: W / H,
    maxHeight: 220,
    borderRadius: 20,
    overflow: 'hidden',
  },
});

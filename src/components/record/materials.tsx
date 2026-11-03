import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Lighten (amt > 0) or darken (amt < 0) a #RRGGBB color. */
export function shade(hex: string, amt: number): string {
  const base = hex.length >= 7 ? hex.slice(0, 7) : '#888888';
  const n = parseInt(base.slice(1), 16);
  const ch = (v: number) => {
    const t = amt >= 0 ? 255 : 0;
    return Math.round(v + (t - v) * Math.abs(amt));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// A fixed scatter of speckles so the grain looks the same every render.
const GRAIN = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.1234;
  const c = Math.sin(i * 39.346) * 9871.337;
  const f = (v: number) => v - Math.floor(v);
  return { x: f(a) * 100, y: f(b) * 100, r: 0.5 + f(c) * 0.9, light: i % 2 === 0 };
});

/** Raised, slightly rubbery button face: vertical gradient, top sheen, dark lower lip and fine grain. */
export function ButtonSkin({ color, radius }: { color: string; radius: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(color, 0.28)} />
          <Stop offset="0.5" stopColor={color} />
          <Stop offset="1" stopColor={shade(color, -0.22)} />
        </LinearGradient>
        <LinearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill={`url(#b${id})`} />
      {GRAIN.map((g, i) => (
        <Circle key={i} cx={`${g.x}%`} cy={`${g.y}%`} r={g.r} fill={g.light ? '#FFFFFF' : '#000000'} opacity={g.light ? 0.16 : 0.1} />
      ))}
      {/* top sheen */}
      <Rect x="3" y="2" width="99%" height="42%" rx={radius - 2} fill={`url(#s${id})`} transform="translate(-1.5 0)" />
      {/* bevel edges */}
      <Rect x="0.5" y="0.5" width="99.5%" height="99%" rx={radius} fill="none" stroke={shade(color, 0.45)} strokeOpacity="0.55" strokeWidth="1" />
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill="none" stroke={shade(color, -0.45)} strokeOpacity="0.35" strokeWidth="1" />
    </Svg>
  );
}

/** A glossy glass-like bead: spherical shading, specular highlight, bounce light along the bottom. */
export function BeadSkin({ color, size }: { color: string; size: number }) {
  const id = useId().replace(/:/g, '');
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={`g${id}`} cx="35%" cy="28%" rx="85%" ry="85%" fx="35%" fy="28%">
          <Stop offset="0" stopColor={shade(color, 0.5)} />
          <Stop offset="0.45" stopColor={color} />
          <Stop offset="1" stopColor={shade(color, -0.45)} />
        </RadialGradient>
        <RadialGradient id={`r${id}`} cx="50%" cy="100%" rx="60%" ry="40%">
          <Stop offset="0" stopColor={shade(color, 0.55)} stopOpacity="0.55" />
          <Stop offset="1" stopColor={shade(color, 0.55)} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#g${id})`} />
      <Circle cx={r} cy={r} r={r} fill={`url(#r${id})`} />
      <Circle cx={r} cy={r} r={r - 0.5} fill="none" stroke={shade(color, -0.5)} strokeOpacity="0.5" strokeWidth="1" />
      <Ellipse cx={size * 0.36} cy={size * 0.25} rx={size * 0.19} ry={size * 0.11} fill="#FFFFFF" opacity="0.7" transform={`rotate(-30 ${size * 0.36} ${size * 0.25})`} />
      <Circle cx={size * 0.66} cy={size * 0.72} r={size * 0.04} fill="#FFFFFF" opacity="0.35" />
    </Svg>
  );
}

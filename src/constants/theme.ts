/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  // Palette drawn from climbing materials: chalk, granite and dynamic rope.
  light: {
    text: '#1F2D35', // granite
    background: '#F6F8F7', // chalk
    backgroundElement: '#E7EDEB',
    backgroundSelected: '#D5E0DD',
    surface: '#FFFFFF', // cards sit on the chalk background
    border: '#DFE7E4',
    textSecondary: '#5A6A70',
    accent: '#0E7A80', // rope teal
    accentSoft: '#D6ECEC',
    onAccent: '#FFFFFF',
  },
  dark: {
    text: '#EEF3F1',
    background: '#141E23',
    backgroundElement: '#1F2D35',
    backgroundSelected: '#2A3B44',
    surface: '#1C2A31',
    border: '#2C3D46',
    textSecondary: '#A3B2B6',
    accent: '#46B8BD',
    accentSoft: '#173A3E',
    onAccent: '#0B1A1D',
  },
} as const;

/**
 * Gym hold colors. Used only in illustrations and to color-code topics, the
 * way gyms tape routes by color — never as general UI decoration.
 */
export const HoldColors = {
  yellow: '#F2B705',
  coral: '#E2554A',
  green: '#3F9A5B',
  purple: '#7A5BC4',
  blue: '#2F7FD1',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Depth. Light comes from above: surfaces carry a bright top edge and a soft, tinted shadow
 * (granite, not black) so cards and controls sit on the page instead of lying flat on it.
 */
export const Depth = {
  light: {
    card: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(14,42,46,0.06), 0 8px 20px -8px rgba(14,42,46,0.14)',
    raised: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(14,42,46,0.08), 0 14px 28px -10px rgba(14,42,46,0.22)',
    button: 'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14), 0 6px 14px -4px rgba(14,122,128,0.55)',
    buttonRaised: 'inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.14), 0 10px 20px -4px rgba(14,122,128,0.6)',
    buttonPressed: 'inset 0 2px 4px rgba(0,0,0,0.22)',
    page: ['#F8FAF9', '#E8F0EE'],
    gradient: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%)',
  },
  dark: {
    card: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.4), 0 10px 24px -10px rgba(0,0,0,0.6)',
    raised: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 4px rgba(0,0,0,0.45), 0 16px 30px -10px rgba(0,0,0,0.7)',
    button: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.25), 0 6px 16px -4px rgba(70,184,189,0.35)',
    buttonRaised: 'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -2px 0 rgba(0,0,0,0.25), 0 10px 22px -4px rgba(70,184,189,0.45)',
    buttonPressed: 'inset 0 2px 5px rgba(0,0,0,0.4)',
    page: ['#16222A', '#0F181C'],
    gradient: 'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 60%)',
  },
} as const;

/** A vertical gradient as a style, for web (backgroundImage) and phones (experimental_backgroundImage). */
export function gradientStyle(css: string): object {
  return Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css };
}

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = Platform.OS === 'web' ? 960 : 800;
/** Reading pages (policies, articles) stay narrower so lines stay short. */
export const ReadableWidth = 720;

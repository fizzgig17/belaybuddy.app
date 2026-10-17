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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

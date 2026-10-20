import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseBanner } from '@/lib/banner-format';
import { useBanner } from '@/lib/banner';
import { openLink } from '@/lib/open-link';

/** Warm and clear, but softer than the orange dev strip: a pale gold in light mode, a deep amber in dark. */
const PALETTE = {
  light: { bg: '#FFF3D1', border: '#EBCB73', text: '#3B2F0B', link: '#7A4B00', icon: '#B07A00' },
  dark: { bg: '#3A3014', border: '#6B5820', text: '#F6E7B4', link: '#FFD26A', icon: '#F2B705' },
} as const;

/** The message text, with the few supported marks turned into bold, italic and links. */
export function BannerText({ message, scheme = 'light' }: { message: string; scheme?: 'light' | 'dark' }) {
  const c = PALETTE[scheme];
  return (
    <ThemedText type="small" maxFontSizeMultiplier={1.15} style={[styles.text, { color: c.text }]}>
      {parseBanner(message).map((p, i) => {
        if (p.kind === 'bold') return <ThemedText key={i} type="smallBold" style={{ color: c.text }}>{p.text}</ThemedText>;
        if (p.kind === 'italic') return <ThemedText key={i} type="small" style={{ color: c.text, fontStyle: 'italic' }}>{p.text}</ThemedText>;
        if (p.kind === 'link' || p.kind === 'email') {
          const open = () => (p.kind === 'link' ? openLink(p.url) : void Linking.openURL(`mailto:${p.text}`));
          return (
            <ThemedText key={i} type="smallBold" accessibilityRole="link" onPress={open} style={{ color: c.link, textDecorationLine: 'underline' }}>
              {p.text}
            </ThemedText>
          );
        }
        return p.text;
      })}
    </ThemedText>
  );
}

/** Site-wide notice from the admins. Closing it hides it for good (until site data is cleared). */
export function InfoBanner() {
  const { banner, dismiss } = useBanner();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  if (!banner) return null;
  const c = PALETTE[scheme];
  return (
    <View accessibilityRole="alert" style={[styles.bar, { backgroundColor: c.bg, borderBottomColor: c.border, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.inner}>
        <SymbolView name={Icons.info} size={20} tintColor={c.icon} />
        <View style={styles.body}>
          <BannerText message={banner.message} scheme={scheme} />
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close this notice"
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
          <SymbolView name={Icons.close} size={16} tintColor={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: Spacing.two + 2, paddingHorizontal: Spacing.three },
  inner: { width: '100%', maxWidth: 960, flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  body: { flex: 1 },
  text: { lineHeight: 20 },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});

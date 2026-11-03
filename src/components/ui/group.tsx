import { Children, Fragment, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useCompact } from '@/components/compact';
import { ThemedText } from '@/components/themed-text';
import { Grain } from '@/components/ui/grain';
import { Depth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared surfaces. Cards are a lighter layer than the page, outlined with a hairline
 * and (in light mode) a very soft shadow, so content reads as grouped without heavy boxes.
 */
/** `raised` lifts the card slightly (the pointer is over it, on the website). */
export function Card({ children, style, raised }: { children: ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean }) {
  const theme = useTheme();
  const compact = useCompact();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View
      style={[
        styles.card,
        compact && styles.cCard,
        { backgroundColor: theme.surface, borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(14,42,46,0.16)', boxShadow: raised ? Depth[scheme].raised : Depth[scheme].card },
        Platform.OS === 'web' && ({ transitionProperty: 'transform, box-shadow', transitionDuration: '160ms' } as object),
        raised && { transform: [{ translateY: -2 }] },
        style,
      ]}>
      <Grain radius={20} shade />
      {children}
    </View>
  );
}

/** A card of rows with hairline dividers between them. Use with padded children (see Row). */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Card style={[styles.group, style]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}

/** Padded row for use inside a Group. */
export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const compact = useCompact();
  return <View style={[styles.row, compact && styles.cRow, style]}>{children}</View>;
}

/** Titled section: a small quiet heading above its content, optional footnote below. */
export function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  const compact = useCompact();
  return (
    <View style={[styles.section, compact && { gap: 4 }]}>
      {title && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle} accessibilityRole="header">
          {title.toUpperCase()}
        </ThemedText>
      )}
      {children}
      {footer && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          {footer}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cCard: { padding: Spacing.two + 2, gap: Spacing.two },
  cRow: { paddingVertical: 6, gap: 4 },
  group: { padding: 0, gap: 0, overflow: 'visible' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  row: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three - 2, gap: Spacing.two },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: 600, letterSpacing: 0.6, marginLeft: Spacing.three },
  footer: { marginHorizontal: Spacing.three },
});

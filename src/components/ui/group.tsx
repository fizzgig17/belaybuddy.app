import { Children, Fragment, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared surfaces. Cards are a lighter layer than the page, outlined with a hairline
 * and (in light mode) a very soft shadow, so content reads as grouped without heavy boxes.
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, shadow, style]}>
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
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Titled section: a small quiet heading above its content, optional footnote below. */
export function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
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

const shadow: ViewStyle =
  Platform.OS === 'ios'
    ? { shadowColor: '#0E2A2E', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
    : Platform.OS === 'android'
      ? { elevation: 1 }
      : {};

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  group: { padding: 0, gap: 0, overflow: 'visible' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  row: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three - 2, gap: Spacing.two },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: 600, letterSpacing: 0.6, marginLeft: Spacing.three },
  footer: { marginHorizontal: Spacing.three },
});

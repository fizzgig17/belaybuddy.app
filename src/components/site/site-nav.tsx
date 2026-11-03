import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LINKS: [Href, string][] = [
  ['/manual', 'Manual'],
  ['/support', 'Support'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/delete-account', 'Delete account'],
];

/** Footer links for the informational website. */
export function SiteLinks() {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {LINKS.map(([href, label]) => (
        <Link key={label} href={href} asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {label}
            </ThemedText>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three } });

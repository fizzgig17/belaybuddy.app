import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons, type IconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeatureCardProps = {
  title: string;
  description: string;
  icon?: IconName;
  /** Optional route; when set, the card is tappable. */
  href?: Href;
  /** Shows a "Coming soon" tag for features that are only stubbed. */
  comingSoon?: boolean;
  /** Icon color, e.g. a hold color to color-code a topic. Defaults to the accent. */
  tint?: string;
};

export function FeatureCard({ title, description, icon, href, comingSoon, tint }: FeatureCardProps) {
  const theme = useTheme();

  const body = (
    <ThemedView type="backgroundElement" style={styles.card}>
      {icon && (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: tint ? `${tint}26` : theme.accentSoft },
          ]}>
          <SymbolView name={Icons[icon]} size={22} tintColor={tint ?? theme.accent} />
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>
          {comingSoon && (
            <ThemedText type="small" style={[styles.tag, { color: theme.accent }]}>
              Coming soon
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      {href && <SymbolView name={Icons.chevron} size={14} tintColor={theme.textSecondary} />}
    </ThemedView>
  );

  if (!href) return body;

  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>{body}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flexShrink: 1 },
  tag: { fontSize: 12 },
  pressed: { opacity: 0.7 },
});

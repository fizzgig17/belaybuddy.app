import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName, isNewMember, WEIGHT_HINT_TEXT } from '@/lib/partners';
import type { ClimberCard } from '@/types/models';

const BELAY_LABELS = { 'top-rope': 'Top-rope belay', lead: 'Lead belay' } as const;

/** Short trust summary of a climber; taps through to their full card. */
export function ClimberSummary({
  card,
  postId,
  trailing,
}: {
  card: ClimberCard;
  postId?: string;
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const grades = [card.routeGrade, card.boulderGrade].filter(Boolean).join(' · ');
  const belay = card.belayCertified.map((b) => BELAY_LABELS[b]).join(', ');

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({ pathname: '/partners/climber', params: { id: card.userId, ...(postId ? { post: postId } : {}) } })
        }
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <SymbolView name={Icons.person} size={36} tintColor={theme.textSecondary} />
        <View style={styles.body}>
          <ThemedText type="smallBold">
            {displayName(card)}
            {isNewMember(card) && (
              <ThemedText type="small" themeColor="textSecondary">
                {'  '}New member
              </ThemedText>
            )}
          </ThemedText>
          {(grades || card.yearsClimbing != null) && (
            <ThemedText type="small" themeColor="textSecondary">
              {[grades, card.yearsClimbing != null ? `${card.yearsClimbing} yr climbing` : '']
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          )}
          {belay ? (
            <ThemedText type="small" themeColor="textSecondary">
              {belay} (self-reported)
            </ThemedText>
          ) : null}
          {card.weightHint && (
            <View style={styles.hint}>
              <SymbolView
                name={Icons.scale}
                size={14}
                tintColor={card.weightHint === 'similar' ? HoldColors.green : HoldColors.yellow}
              />
              <ThemedText type="small" style={styles.flex}>
                {WEIGHT_HINT_TEXT[card.weightHint]}
              </ThemedText>
            </View>
          )}
        </View>
        <SymbolView name={Icons.chevron} size={14} tintColor={theme.textSecondary} />
      </Pressable>
      {trailing}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  main: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  body: { flex: 1, gap: Spacing.half },
  hint: { flexDirection: 'row', gap: Spacing.one, alignItems: 'flex-start', marginTop: Spacing.one },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
});

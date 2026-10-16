import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  displayName,
  formatGrades,
  formatWindow,
  GOAL_LABELS,
  isNewMember,
  POST_STYLE_LABELS,
} from '@/lib/partners';
import type { BelayPost, ClimberCard } from '@/types/models';

type Props = {
  post: BelayPost;
  card?: ClimberCard;
  /** Shown on the right, e.g. "2 in" on your own posts. */
  badge?: string;
  /** Show the gym name (for lists that mix gyms). */
  showGym?: boolean;
};

/** One belay board post. Tapping opens the session. */
export function PostCard({ post, card, badge, showGym }: Props) {
  const theme = useTheme();
  const grades = formatGrades(post);
  const details = [GOAL_LABELS[post.goal], ...post.styles.map((s) => POST_STYLE_LABELS[s]), grades]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/partners/post', params: { id: post.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.top}>
          <View style={[styles.when, post.hereNow && { backgroundColor: `${HoldColors.green}26` }]}>
            <SymbolView
              name={Icons.clock}
              size={14}
              tintColor={post.hereNow ? HoldColors.green : theme.textSecondary}
            />
            <ThemedText type="smallBold" style={post.hereNow ? { color: HoldColors.green } : undefined}>
              {formatWindow(post)}
            </ThemedText>
          </View>
          {badge && (
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {badge}
            </ThemedText>
          )}
        </View>

        <ThemedText>
          {displayName(card)}
          {card && isNewMember(card) && (
            <ThemedText type="small" themeColor="textSecondary">
              {'  '}New member
            </ThemedText>
          )}
        </ThemedText>
        {showGym && (
          <ThemedText type="small" themeColor="textSecondary">
            {post.areaName}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {details}
          {post.mentoring ? ' · Happy to mentor' : ''}
        </ThemedText>
        {post.note && (
          <ThemedText type="small" numberOfLines={2}>
            {post.note}
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
    marginLeft: -Spacing.two,
  },
  pressed: { opacity: 0.7 },
});

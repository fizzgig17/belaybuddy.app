import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openLink } from '@/lib/open-link';
import { getLearnTopic, LEARN_TOPICS } from '@/content/learn';

/** Website: pre-render a page per topic (learn/safety.html, ...). */
export async function generateStaticParams(): Promise<Record<string, string>[]> {
  return LEARN_TOPICS.map((topic) => ({ topic: topic.id }));
}

export default function LearnTopicScreen() {
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();
  const topic = getLearnTopic(topicId);
  const theme = useTheme();

  if (!topic) {
    return (
      <Screen title="Not found" showTitle={false}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <ThemedText>That topic doesn't exist.</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen title={topic.title} subtitle={topic.summary} showTitle={false}>
      <Stack.Screen options={{ title: topic.title }} />
      <ThemedView type="backgroundElement" style={styles.disclaimer}>
        <ThemedText type="small" themeColor="textSecondary">
          Climbing is dangerous. This guide is not a substitute for instruction from a qualified
          climbing instructor. Each article summarizes the public sources linked under it. Check them,
          and your gym’s own rules, before you rely on it.
        </ThemedText>
      </ThemedView>
      {topic.articles.map((article) =>
        article.points ? (
          <ThemedView key={article.title} type="backgroundElement" style={styles.article}>
            <ThemedText type="smallBold" accessibilityRole="header">
              {article.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {article.summary}
            </ThemedText>
            {article.points.map((point) => (
              <ThemedText key={point} type="small" style={styles.point}>
                {'•  '}
                {point}
              </ThemedText>
            ))}
            {article.sources && (
              <View style={styles.sources}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Sources
                </ThemedText>
                {article.sources.map((source) => (
                  <Pressable key={source.url} accessibilityRole="link" onPress={() => openLink(source.url)}>
                    <ThemedText type="small" style={{ color: theme.accent }}>
                      {source.title} ↗
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </ThemedView>
        ) : (
          <FeatureCard
            key={article.title}
            title={article.title}
            description={article.summary}
            externalUrl={article.url}
            comingSoon={!article.url}
          />
        ),
      )}
      {topic.credit && (
        <Pressable
          accessibilityRole="link"
          onPress={() => openLink(topic.credit!.url)}>
          <ThemedText type="small" themeColor="textSecondary">
            {topic.credit.text} · animatedknots.com
          </ThemedText>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  article: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  point: { paddingLeft: Spacing.two },
  sources: { gap: Spacing.one, paddingTop: Spacing.one },
  disclaimer: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});

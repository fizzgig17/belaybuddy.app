import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getLearnTopic } from '@/content/learn';

export default function LearnTopicScreen() {
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();
  const topic = getLearnTopic(topicId);

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
          climbing instructor.
        </ThemedText>
      </ThemedView>
      {topic.articles.map((article) => (
        <FeatureCard
          key={article.title}
          title={article.title}
          description={article.summary}
          comingSoon
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});

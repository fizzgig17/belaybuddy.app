import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';
import { LEARN_TOPICS } from '@/content/learn';

export default function LearnScreen() {
  return (
    <Screen title="Learn" subtitle="Safety, gear, and knots.">
      {LEARN_TOPICS.map((topic) => (
        <FeatureCard
          key={topic.id}
          icon={topic.icon}
          title={topic.title}
          description={topic.summary}
          href={{ pathname: '/learn/[topic]', params: { topic: topic.id } }}
        />
      ))}
    </Screen>
  );
}

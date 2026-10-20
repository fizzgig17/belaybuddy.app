import { FeatureCard } from '@/components/feature-card';
import { CragBanner } from '@/components/illustrations';
import { Screen } from '@/components/screen';
import { LEARN_TOPICS } from '@/content/learn';

export default function LearnScreen() {
  return (
    <Screen profileButton title="Learn" subtitle="Safety, gear, and knots.">
      <CragBanner />
      {LEARN_TOPICS.map((topic) => (
        <FeatureCard
          key={topic.id}
          icon={topic.icon}
          tint={topic.color}
          title={topic.title}
          description={topic.summary}
          href={{ pathname: '/learn/[topic]', params: { topic: topic.id } }}
        />
      ))}
    </Screen>
  );
}

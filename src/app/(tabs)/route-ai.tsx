import { FeatureCard } from '@/components/feature-card';
import { GymWallBanner } from '@/components/illustrations';
import { WallScanner } from '@/components/route-ai/wall-scanner';
import { Screen } from '@/components/screen';

export default function RouteAIScreen() {
  return (
    <Screen
      profileButton
      title="Route AI"
      subtitle="Photograph a gym wall, pick a hold color, and see the route mapped out.">
      <GymWallBanner />
      <WallScanner />
      <FeatureCard
        icon="tips"
        title="Technique tips"
        description="Hold types (jug, crimp, sloper, pinch, pocket) and how to use each one. One possible way to climb it, not the only way."
        comingSoon
      />
    </Screen>
  );
}

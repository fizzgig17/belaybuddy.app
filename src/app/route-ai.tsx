import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';

export default function RouteAIScreen() {
  return (
    <Screen
      title="Route AI"
      subtitle="Photograph a gym wall, pick a hold color, and see the route mapped out.">
      <FeatureCard
        icon="camera"
        title="Scan a wall"
        description="Take or pick a photo, then tap a hold to choose the route's color."
        comingSoon
      />
      <FeatureCard
        icon="hand.point.up.left"
        title="Hold map"
        description="Every hold of that color highlighted. Tap to add or remove any the detector missed."
        comingSoon
      />
      <FeatureCard
        icon="lightbulb"
        title="Technique tips"
        description="Hold types (jug, crimp, sloper, pinch, pocket) and how to use each one. One possible way to climb it, not the only way."
        comingSoon
      />
    </Screen>
  );
}

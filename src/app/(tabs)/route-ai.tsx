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
    </Screen>
  );
}

import { GymWallBanner } from '@/components/illustrations';
import { WallScanner } from '@/components/route-ai/wall-scanner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function RouteAIScreen() {
  return (
    <Screen
      profileButton
      title="Route AI"
      subtitle="Photograph a gym wall, pick a hold color, and see the route mapped out.">
      <ThemedView type="backgroundElement" style={{ padding: 14, borderRadius: 14, gap: 4 }}>
        <ThemedText type="smallBold">Still in testing</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Route AI is an early version. Hold detection and tips can be wrong, so double-check them. Your feedback helps us improve it.
        </ThemedText>
      </ThemedView>
      <GymWallBanner />
      <WallScanner />
    </Screen>
  );
}

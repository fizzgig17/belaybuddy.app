import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';

export default function PartnersScreen() {
  return (
    <Screen title="Partners" subtitle="Find people to climb with at home or on the road.">
      <FeatureCard
        icon="location"
        title="Climbers near you"
        description="Listings in your area. Only an approximate area is ever shown, never your exact location."
        comingSoon
      />
      <FeatureCard
        icon="airplane"
        title="Traveling?"
        description="Post the place and dates you'll be visiting and see who's climbing there."
        comingSoon
      />
      <FeatureCard
        icon="hand.raised"
        title="Safety & reporting"
        description="Block or report anyone, and tips for meeting a new partner safely."
        comingSoon
      />
    </Screen>
  );
}

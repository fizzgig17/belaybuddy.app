import { FeatureCard } from '@/components/feature-card';
import { CragBanner } from '@/components/illustrations';
import { Screen } from '@/components/screen';

export default function FindScreen() {
  return (
    <Screen title="Find" subtitle="Climbing gyms and outdoor crags near you or wherever you're headed.">
      <CragBanner />
      <FeatureCard
        icon="gym"
        title="Indoor gyms"
        description="Nearby bouldering and roped gyms, with hours, styles, and directions."
        comingSoon
      />
      <FeatureCard
        icon="crag"
        title="Outdoor crags"
        description="Crags and routes from OpenBeta, filterable by style and grade."
        comingSoon
      />
      <FeatureCard
        icon="favorite"
        title="Favorites"
        description="Save gyms and crags you climb at. Requires an account."
        comingSoon
      />
    </Screen>
  );
}

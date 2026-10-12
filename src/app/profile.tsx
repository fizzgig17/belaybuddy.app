import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/screen';

export default function ProfileScreen() {
  return (
    <Screen title="Profile" subtitle="Sign in to save favorites and find partners.">
      <FeatureCard
        icon="person.badge.key"
        title="Sign in"
        description="Continue with Apple, Google, Facebook, or email."
        comingSoon
      />
      <FeatureCard
        icon="figure.climbing"
        title="Climbing profile"
        description="Your styles, grades, gear, and belay certifications."
        comingSoon
      />
      <FeatureCard
        icon="gearshape"
        title="Settings & privacy"
        description="Location sharing, blocked users, and account deletion."
        comingSoon
      />
    </Screen>
  );
}

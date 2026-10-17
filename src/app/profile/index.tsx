import { router } from 'expo-router';
import { ActivityIndicator, Platform } from 'react-native';

import { SignIn } from '@/components/auth/sign-in';
import { GymWallBanner } from '@/components/illustrations';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { Screen } from '@/components/screen';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';

function closeProfile() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

/** iPhone and Android close this sheet with a swipe down; the website has no such gesture. */
const closeAction = Platform.OS === 'web' ? <IconButton icon="close" label="Close" onPress={closeProfile} /> : undefined;

export default function ProfileScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Screen title="Profile" action={closeAction}>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen title="Profile" action={closeAction} subtitle="Sign in to save favorites, set up your climbing profile, and find partners.">
        <GymWallBanner />
        <SignIn />
      </Screen>
    );
  }

  return (
    <Screen
      title="Profile"
      action={closeAction}>
      <ThemedText type="small" themeColor="textSecondary">
        Signed in as {user.email}
      </ThemedText>
      <ProfileEditor userId={user.id} />
    </Screen>
  );
}

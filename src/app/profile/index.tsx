import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SignIn } from '@/components/auth/sign-in';
import { GymWallBanner } from '@/components/illustrations';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { Screen } from '@/components/screen';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

function closeProfile() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

function CloseButton() {
  return <IconButton icon="close" label="Close" onPress={closeProfile} />;
}

export default function ProfileScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Screen title="Profile" action={<CloseButton />}>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen title="Profile" action={<CloseButton />} subtitle="Sign in to save favorites, set up your climbing profile, and find partners.">
        <GymWallBanner />
        <SignIn />
      </Screen>
    );
  }

  return (
    <Screen
      title="Profile"
      action={
        <View style={styles.buttons}>
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/profile/settings')} />
          <CloseButton />
        </View>
      }>
      <ThemedText type="small" themeColor="textSecondary">
        Signed in as {user.email}
      </ThemedText>
      <ProfileEditor userId={user.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: Spacing.two },
});

import { useState } from 'react';
import { ActivityIndicator, Alert, Platform } from 'react-native';

import { SignIn } from '@/components/auth/sign-in';
import { FeatureCard } from '@/components/feature-card';
import { GymWallBanner } from '@/components/illustrations';
import { Button } from '@/components/form';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (loading) {
    return (
      <Screen title="Profile">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen title="Profile" subtitle="Sign in to save favorites, set up your climbing profile, and find partners.">
        <GymWallBanner />
        <SignIn />
      </Screen>
    );
  }

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  function confirmSignOut() {
    if (Platform.OS === 'web') {
      signOut();
      return;
    }
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen title="Profile">
      <ThemedText type="small" themeColor="textSecondary">
        Signed in as {user.email}
      </ThemedText>
      <ProfileEditor userId={user.id} />
      <FeatureCard
        icon="settings"
        title="Settings & privacy"
        description="Location sharing, blocked users, and account deletion."
        comingSoon
      />
      <Button title="Sign out" variant="secondary" onPress={confirmSignOut} loading={signingOut} />
    </Screen>
  );
}

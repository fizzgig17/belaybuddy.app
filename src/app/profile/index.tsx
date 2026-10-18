import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform } from 'react-native';

import { SignIn } from '@/components/auth/sign-in';
import { GymWallBanner } from '@/components/illustrations';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/themed-text';
import { signOut, useAuth } from '@/lib/auth';

function closeProfile() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

/** iPhone and Android close this sheet with a swipe down; the website has no such gesture. */
const closeAction = Platform.OS === 'web' ? <IconButton icon="close" label="Close" onPress={closeProfile} /> : undefined;

export default function ProfileScreen() {
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Signing in from this sheet takes you to the start page (or back to what you
  // were doing, such as a friend link), not to your profile.
  const wasSignedOut = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!user) {
      wasSignedOut.current = true;
    } else if (wasSignedOut.current) {
      wasSignedOut.current = false;
      closeProfile();
    }
  }, [user, loading]);

  async function doSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  function confirmSignOut() {
    if (Platform.OS === 'web') return doSignOut();
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: doSignOut },
    ]);
  }

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
      <Button title="Sign out" variant="secondary" onPress={confirmSignOut} loading={signingOut} />
    </Screen>
  );
}

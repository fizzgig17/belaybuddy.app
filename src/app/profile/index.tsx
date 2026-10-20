import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform } from 'react-native';

import { SignIn } from '@/components/auth/sign-in';
import { GymWallBanner } from '@/components/illustrations';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { Button } from '@/components/form';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/screen';
import { closeProfile, ProfilePager, SheetActions } from '@/components/profile/pager';
import { SettingsPage } from '@/components/profile/settings-page';
import { ThemedText } from '@/components/themed-text';
import { AdminPage } from '@/components/profile/admin-page';
import { useIsAdmin } from '@/lib/admin';
import { signOut, useAuth } from '@/lib/auth';

/** The close button for the signed-out sheet. Swiping down also closes it on phones. */
const closeOnly = <IconButton icon="close" label="Close" onPress={closeProfile} />;

export default function ProfileSheet() {
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const isAdmin = useIsAdmin();

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
      <Screen title="Profile" action={closeOnly}>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen title="Profile" action={closeOnly} subtitle="Sign in to save favorites, set up your climbing profile, and find partners.">
        <GymWallBanner />
        <SignIn />
      </Screen>
    );
  }

  return (
    <ProfilePager
      pages={[
        {
          key: 'profile',
          label: 'Profile',
          content: (
            <Screen title="Profile" embedded action={<SheetActions to="settings" />}>
              <ThemedText type="small" themeColor="textSecondary">
                Signed in as {user.email}
              </ThemedText>
              <ProfileEditor userId={user.id} />
              <Button title="Sign out" variant="secondary" onPress={confirmSignOut} loading={signingOut} />
            </Screen>
          ),
        },
        { key: 'settings', label: 'Settings', content: <SettingsPage /> },
        ...(isAdmin ? [{ key: 'admin', label: 'Admin', content: <AdminPage /> }] : []),
      ]}
    />
  );
}

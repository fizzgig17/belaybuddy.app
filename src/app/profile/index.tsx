import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { SignIn } from '@/components/auth/sign-in';
import { GymWallBanner } from '@/components/illustrations';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, loading } = useAuth();

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

  return (
    <Screen
      title="Profile"
      action={
        <Pressable
          onPress={() => router.push('/profile/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={12}
          style={({ pressed }) => [styles.gear, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
          <SymbolView name={Icons.settings} size={22} tintColor={theme.text} />
        </Pressable>
      }>
      <ThemedText type="small" themeColor="textSecondary">
        Signed in as {user.email}
      </ThemedText>
      <ProfileEditor userId={user.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.two },
  pressed: { opacity: 0.6 },
});

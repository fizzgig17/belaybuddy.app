import { Link, Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRIVACY_CONTACT } from '@/content/privacy';

/** Public page describing how to delete a Belay Buddy account (required by app stores). */
export default function DeleteAccountScreen() {
  return (
    <Screen title="Delete your account" description="How to delete your Belay Buddy account and the data that goes with it." showTitle={Platform.OS === 'web'} readable>
      <Stack.Screen options={{ headerShown: Platform.OS !== 'web', title: 'Delete your account', headerBackTitle: 'Back' }} />
      {Platform.OS !== 'web' && (
        <ThemedText type="subtitle" accessibilityRole="header">Delete your Belay Buddy account</ThemedText>
      )}
      <ThemedText>
        You can delete your account and its data yourself, in the app or on the website. It takes less than a minute.
      </ThemedText>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">Steps</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">1. Open Belay Buddy (the app, or belaybuddy.app) and sign in.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">2. Tap the settings button, then open Privacy & safety.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">3. Tap Delete account and confirm.</ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">What is deleted</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your profile, favorites, home gyms, partner posts and chats, climbing session logs, friends and check-ins, and your notification settings. This is permanent and cannot be undone. We do not keep copies of your Route AI photos.
        </ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">Can’t sign in?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Email {PRIVACY_CONTACT} from the address on the account and ask us to delete it. We will confirm once it is done.
        </ThemedText>
      </View>
      <Link href="/privacy">
        <ThemedText type="small">Read the privacy policy</ThemedText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
});

import { Link, Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRIVACY_CONTACT } from '@/content/privacy';

/** Public support page: the support URL given to the app stores. */
export default function SupportScreen() {
  return (
    <Screen title="Support" description="Help with Belay Buddy: contact us, report a problem, delete your account." showTitle={Platform.OS === 'web'} readable>
      <Stack.Screen options={{ headerShown: Platform.OS !== 'web', title: 'Support', headerBackTitle: 'Back' }} />
      {Platform.OS !== 'web' && (
        <ThemedText type="subtitle" accessibilityRole="header">Belay Buddy support</ThemedText>
      )}
      <ThemedText>Need help, found a bug, or have an idea? Email us and a person will reply.</ThemedText>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">Contact</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {PRIVACY_CONTACT}. Tell us what you were doing, which phone you use (or the website), and what happened. A screenshot helps.
        </ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">Report or block a climber</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Open the climber’s profile and tap Report, then choose a reason. You can also block a climber from their profile so you no longer see each other. For anything urgent or unsafe, email us as well and include the name and what happened. If someone is in danger, call your local emergency number first.
        </ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">Account and data</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You can delete your account yourself in Settings under Privacy & safety. If you cannot sign in, email us from the address on the account.
        </ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">Climbing safety</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Belay Buddy’s safety guides are general information, not instruction. Climbing is dangerous. Learn from a qualified instructor and always do a partner check.
        </ThemedText>
      </View>
      <View style={styles.links}>
        <Link href="/privacy">
          <ThemedText type="small">Privacy policy</ThemedText>
        </Link>
        <Link href="/terms">
          <ThemedText type="small">Terms of use</ThemedText>
        </Link>
        <Link href="/delete-account">
          <ThemedText type="small">Delete your account</ThemedText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  links: { gap: Spacing.two },
});

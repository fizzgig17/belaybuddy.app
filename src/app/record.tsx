import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { SessionBody } from '@/components/record/session-body';
import { Spacing } from '@/constants/theme';

/**
 * Record a session. The round button in the middle of the tab bar slides this up over the current tab. Photograph a
 * route tag and the grade, hold color and name fill in, or pick them by hand, then tap Sent, Flash or Attempt.
 * iPhone: pull the grabber line down to close. Android and the website: the X.
 */
export default function RecordSession() {
  return (
    <Screen title="Record session" showTitle={false}>
      <View style={styles.header}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
          Record session
        </ThemedText>
        {Platform.OS !== 'ios' && (
          <IconButton icon="close" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        )}
      </View>
      <SessionBody />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingTop: Spacing.three },
  title: { flexShrink: 1 },
});

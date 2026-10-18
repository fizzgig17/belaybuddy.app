import { Linking, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** Set to the App Store link once the app is listed. */
const STORE_URL = process.env.EXPO_PUBLIC_APP_STORE_URL;

const onPhoneBrowser = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/**
 * "Use the app" prompt shown to people on a phone's web browser; nothing in the
 * app itself or on a computer. `path` is the in-app route to open, e.g.
 * "/friend/ABCD2345". Opens the app if it is installed.
 */
export function AppCard({ path = '' }: { path?: string }) {
  if (!onPhoneBrowser()) return null;
  const open = () => Linking.openURL(`belaybuddy://${path.replace(/^\//, '')}`);
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Belay Buddy works best as an app</ThemedText>
      <ThemedText type="small">
        Check-ins, friend alerts and the camera tools are in the app. Already have it? Open it here.
      </ThemedText>
      <Button title="Open in the app" variant="secondary" onPress={open} />
      {STORE_URL ? <Button title="Get the app" onPress={() => Linking.openURL(STORE_URL)} /> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, gap: 8 },
});

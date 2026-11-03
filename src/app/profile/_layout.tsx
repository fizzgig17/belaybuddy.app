import { router, Stack } from 'expo-router';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export default function ProfileLayout() {
  const theme = useTheme();
  const win = useWindowDimensions();
  const stack = (
    <Stack screenOptions={{ headerBackTitle: 'Profile' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
  // iPhone gets a native form sheet. Android and the website get the same look by hand: dimmed behind, inset a few
  // points from the sides, topping out at the same spot as the record sheet.
  if (Platform.OS === 'ios') return stack;
  return (
    <View style={styles.dim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.panel, { marginTop: Math.round(win.height * 0.134), backgroundColor: theme.background }]}>{stack}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: '#00000040' },
  panel: { flex: 1, marginHorizontal: 7, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
});

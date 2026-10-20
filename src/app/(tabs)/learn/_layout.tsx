import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function LearnLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[topic]" options={{ headerBackTitle: 'Learn', headerShown: Platform.OS !== 'web' }} />
    </Stack>
  );
}

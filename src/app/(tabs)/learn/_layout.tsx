import { Stack } from 'expo-router';

export default function LearnLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[topic]" options={{ headerBackTitle: 'Learn' }} />
    </Stack>
  );
}

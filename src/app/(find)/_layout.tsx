import { Stack } from 'expo-router';

export default function FindLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="area/[id]" options={{ headerBackTitle: 'Find', title: '' }} />
    </Stack>
  );
}

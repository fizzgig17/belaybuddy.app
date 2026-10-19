import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Profile' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin' }} />
    </Stack>
  );
}

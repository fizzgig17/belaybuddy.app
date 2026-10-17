import { Stack } from 'expo-router';

export default function PartnersLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Partners' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Post to the board' }} />
      <Stack.Screen name="post" options={{ title: 'Session' }} />
      <Stack.Screen name="session" options={{ title: 'Climb log' }} />
      <Stack.Screen name="sessions" options={{ title: 'Past sessions' }} />
      <Stack.Screen name="chat" options={{ title: 'Chat' }} />
      <Stack.Screen name="friends" options={{ title: 'Friends' }} />
      <Stack.Screen name="climber" options={{ title: 'Climber' }} />
    </Stack>
  );
}

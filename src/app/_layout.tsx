import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppLock } from '@/components/auth/app-lock';
import { NotificationsBridge } from '@/components/notifications-bridge';
import { AuthProvider } from '@/lib/auth';
import { FavoritesProvider } from '@/lib/favorites';
import { HomeGymsProvider } from '@/lib/home-gyms';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <FavoritesProvider>
        <HomeGymsProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            {/* Profile and Settings sit above the tabs, opened from the buttons at the top right. */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
              <Stack.Screen name="privacy" />
            </Stack>
            <AppLock />
            <NotificationsBridge />
          </ThemeProvider>
        </HomeGymsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

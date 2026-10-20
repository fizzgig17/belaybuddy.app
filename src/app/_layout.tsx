import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppLock } from '@/components/auth/app-lock';
import { DevBanner } from '@/components/dev-banner';
import { NotificationsBridge } from '@/components/notifications-bridge';
import { Colors, Depth, gradientStyle } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/lib/auth';
import { FavoritesProvider } from '@/lib/favorites';
import { HomeGymsProvider } from '@/lib/home-gyms';

SplashScreen.preventAutoHideAsync();

const LightNav = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.light.background } };
const DarkNav = { ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.dark.background } };

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <FavoritesProvider>
        <HomeGymsProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkNav : LightNav}>
            <AnimatedSplashOverlay />
            {/* Profile and Settings sit above the tabs, opened from the buttons at the top right. */}
            <View
              style={[
                { flex: 1, backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background },
                gradientStyle(
                  `linear-gradient(180deg, ${Depth[colorScheme === 'dark' ? 'dark' : 'light'].page[0]} 0%, ${Depth[colorScheme === 'dark' ? 'dark' : 'light'].page[1]} 100%)`,
                ),
              ]}>
              <DevBanner />
              <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
              <Stack.Screen name="about" />
              <Stack.Screen name="privacy" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="delete-account" />
            </Stack>
              </View>
            </View>
            <AppLock />
            <NotificationsBridge />
          </ThemeProvider>
        </HomeGymsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

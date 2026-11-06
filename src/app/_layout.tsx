import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppLock } from '@/components/auth/app-lock';
import { DevBanner } from '@/components/dev-banner';
import { InfoBanner } from '@/components/info-banner';
import { NotificationsBridge } from '@/components/notifications-bridge';
import { PurchasesBridge } from '@/components/purchases-bridge';
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
              <InfoBanner />
              <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              {/* Profile, Settings and Admin: a sheet like the record sheet. iPhone: grabber line to pull down; Android: an X. */}
              <Stack.Screen
                name="profile"
                options={
                  Platform.OS === 'ios'
                    ? { presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.95], sheetCornerRadius: 24 }
                    : { presentation: 'transparentModal', animation: 'slide_from_bottom' }
                }
              />
              <Stack.Screen name="about" />
              <Stack.Screen name="privacy" />
              <Stack.Screen name="support" />
              <Stack.Screen name="manual" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="delete-account" />
              <Stack.Screen name="suggest-place" />
              <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
            </Stack>
              </View>
            </View>
            <AppLock />
            <NotificationsBridge />
            <PurchasesBridge />
          </ThemeProvider>
        </HomeGymsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

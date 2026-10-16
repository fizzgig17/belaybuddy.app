import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

// Push notifications (iOS). Tokens are raw APNs device tokens; the `notify`
// Edge Function sends to Apple directly. See supabase/functions/notify.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const LAST_TOKEN_KEY = 'bb.pushToken';
// Local dev builds talk to Apple's sandbox; TestFlight and App Store builds
// to production.
const ENVIRONMENT = __DEV__ ? 'sandbox' : 'production';

export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported';

export const pushSupported = process.env.EXPO_OS === 'ios';

/** Whether this device can get pushes right now, without asking. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'on';
  return canAskAgain ? 'off' : 'blocked';
}

async function registerToken() {
  const { data } = await Notifications.getDevicePushTokenAsync();
  const token = String(data);
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: 'ios',
    p_environment: ENVIRONMENT,
  });
  if (error) throw error;
  try {
    localStorage.setItem(LAST_TOKEN_KEY, token);
  } catch {
    // Only used to unregister on sign-out.
  }
}

/** Asks for permission (the iOS prompt, once) and registers this device. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported) return 'unsupported';
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (status !== 'granted') return canAskAgain ? 'off' : 'blocked';
  await registerToken();
  return 'on';
}

/** Re-registers on launch (tokens can change) if permission was given. */
export async function syncPushToken() {
  if ((await getPushStatus()) === 'on') await registerToken();
}

/** Stops pushes to this device for the signed-in user. Call before signing out. */
export async function unregisterPushToken() {
  try {
    const token = localStorage.getItem(LAST_TOKEN_KEY);
    if (token) await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    // Signing out must never fail because of this.
  }
}

/** Opens the screen a notification points at when it's tapped. */
export function useNotificationTaps() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { path?: unknown } | undefined;
      if (typeof data?.path === 'string' && data.path.startsWith('/')) {
        router.push(data.path as never);
      }
    };
    // Cold start from a notification.
    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

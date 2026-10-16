import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { syncTimezone } from '@/lib/notification-settings';
import { syncPushToken, useNotificationTaps } from '@/lib/notifications';

/** Keeps this device's push token and time zone current, and opens tapped notifications. */
export function NotificationsBridge() {
  const { user } = useAuth();
  useNotificationTaps();

  useEffect(() => {
    if (!user) return;
    syncPushToken().catch(() => {});
    syncTimezone(user.id).catch(() => {});
  }, [user]);

  return null;
}

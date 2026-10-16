import { supabase } from '@/lib/supabase';

export type NotificationKind = 'responses' | 'messages' | 'reminders';
export type NotificationSettings = Record<`push_${NotificationKind}` | `email_${NotificationKind}`, boolean>;

/** Same defaults as the database (a missing row means these). */
export const DEFAULT_SETTINGS: NotificationSettings = {
  push_responses: true,
  push_messages: true,
  push_reminders: true,
  email_responses: true,
  email_messages: true,
  email_reminders: false,
};

const COLUMNS = Object.keys(DEFAULT_SETTINGS).join(', ');

const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const { data, error } = await supabase.from('notification_settings').select(COLUMNS).maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_SETTINGS, ...((data as Partial<NotificationSettings> | null) ?? {}) };
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings) {
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: userId, ...settings, timezone: deviceTimezone() });
  if (error) throw error;
}

/** Keeps the time zone current so email times read right. Best effort. */
export async function syncTimezone(userId: string) {
  const timezone = deviceTimezone();
  if (!timezone) return;
  await supabase.from('notification_settings').upsert({ user_id: userId, timezone }, { onConflict: 'user_id' });
}

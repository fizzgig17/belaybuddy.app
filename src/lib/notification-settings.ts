import { supabase } from '@/lib/supabase';

export type NotificationKind = 'responses' | 'messages' | 'reminders' | 'friends';
export type NotificationSettings = Record<`push_${NotificationKind}` | `email_${NotificationKind}`, boolean>;

/** Same defaults as the database (a missing row means these). */
export const DEFAULT_SETTINGS: NotificationSettings = {
  push_responses: true,
  push_messages: true,
  push_reminders: true,
  push_friends: true,
  email_responses: true,
  email_messages: true,
  email_reminders: false,
  email_friends: true,
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

export type TestResult = { done: boolean; pushed: number | null; emailed: boolean; error: string | null };

/** Queues a test push and email for the signed-in user; returns its id. */
export async function sendTestNotification(): Promise<number> {
  const { data, error } = await supabase.rpc('send_test_notification');
  if (error) throw error;
  return data as number;
}

/** Waits (up to ~25 s) for the server to try delivering a test. */
export async function waitForTestResult(id: number): Promise<TestResult | null> {
  for (let i = 0; i < 25; i++) {
    const { data, error } = await supabase.rpc('test_notification_result', { p_id: id });
    if (error) throw error;
    const row = (data as TestResult[] | null)?.[0];
    if (row?.done) return row;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

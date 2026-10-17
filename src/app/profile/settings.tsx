import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, StyleSheet, Switch, View } from 'react-native';

import { SignInOptions } from '@/components/auth/sign-in-options';
import { Button } from '@/components/form';
import { PrivacySettings } from '@/components/profile/privacy-settings';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import {
  DEFAULT_SETTINGS,
  fetchNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
  waitForTestResult,
  type NotificationKind,
  type NotificationSettings,
} from '@/lib/notification-settings';
import { enablePush, getPushStatus, pushSupported, type PushStatus } from '@/lib/notifications';

const KINDS: { kind: NotificationKind; title: string; detail: string }[] = [
  { kind: 'responses', title: "Someone's in", detail: 'When a climber joins one of your sessions' },
  { kind: 'messages', title: 'Messages', detail: 'New chat messages (emails at most every 15 minutes per chat)' },
  { kind: 'reminders', title: 'Session reminders', detail: '30 minutes before a session someone has joined' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [push, setPush] = useState<PushStatus>(pushSupported ? 'off' : 'unsupported');
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const refreshPush = useCallback(() => {
    getPushStatus().then(setPush);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotificationSettings()
      .then(setSettings)
      .catch((e: Error) => {
        setSettings(DEFAULT_SETTINGS);
        setError(e.message);
      });
    refreshPush();
    // Coming back from iPhone Settings may have changed the permission.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshPush());
    return () => sub.remove();
  }, [user, refreshPush]);

  if (!user) {
    return (
      <Screen title="Settings" showTitle={false}>
        <ThemedText>Sign in to change your settings.</ThemedText>
        <Button title="Sign in" onPress={() => router.replace('/profile')} />
      </Screen>
    );
  }

  async function change(key: keyof NotificationSettings, value: boolean) {
    if (!settings || !user) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setError(null);
    // Turning on a push switch is the moment to ask iOS for permission.
    if (value && key.startsWith('push_') && push === 'off') setPush(await enablePush());
    try {
      await saveNotificationSettings(user.id, next);
    } catch (e) {
      setSettings(settings);
      setError((e as Error).message);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestMessage(null);
    try {
      // Make sure this phone is registered (no prompt if already allowed).
      let registerProblem: string | null = null;
      if (showPush && push === 'on') {
        try {
          await enablePush();
        } catch (e) {
          registerProblem = (e as Error).message;
        }
      }
      const result = await waitForTestResult(await sendTestNotification());
      if (!result) {
        setTestMessage('Still waiting on the server. Check again in a minute.');
      } else {
        const pushLine = showPush
          ? result.pushed
            ? `Push sent to ${result.pushed} ${result.pushed === 1 ? 'phone' : 'phones'}.`
            : push === 'on'
              ? 'No push went out.'
              : 'No push: this phone isn’t set up for push yet.'
          : null;
        const mail = result.emailed ? `Email sent to ${user?.email}.` : 'No email went out.';
        setTestMessage(
          [
            pushLine,
            mail,
            registerProblem ? `Couldn’t register this phone: ${registerProblem}.` : null,
            result.error ? `Problem: ${result.error}.` : null,
          ]
            .filter(Boolean)
            .join(' '),
        );
      }
    } catch (e) {
      setTestMessage((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function doSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace('/profile');
  }

  function confirmSignOut() {
    if (Platform.OS === 'web') {
      doSignOut();
      return;
    }
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: doSignOut },
    ]);
  }

  const showPush = push !== 'unsupported';

  return (
    <Screen title="Settings" showTitle={false}>
      <Section title="Notifications">
        {showPush && push !== 'on' && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small">
              {push === 'blocked'
                ? 'Notifications are turned off for Belay Buddy in your iPhone’s Settings, so push alerts can’t arrive.'
                : 'Push notifications aren’t turned on for this phone yet.'}
            </ThemedText>
            <Button
              title={push === 'blocked' ? 'Open iPhone Settings' : 'Turn on push notifications'}
              variant="secondary"
              onPress={async () => (push === 'blocked' ? Linking.openSettings() : setPush(await enablePush()))}
            />
          </ThemedView>
        )}

        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.flex} />
            {showPush && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
                Push
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
              Email
            </ThemedText>
          </View>
          {settings === null ? (
            <ActivityIndicator />
          ) : (
            KINDS.map(({ kind, title, detail }) => (
              <View key={kind} style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {detail}
                  </ThemedText>
                </View>
                {showPush && (
                  <View style={styles.col}>
                    <Switch
                      accessibilityLabel={`${title} push notifications`}
                      value={settings[`push_${kind}`] && push === 'on'}
                      disabled={push === 'blocked'}
                      onValueChange={(v) => change(`push_${kind}`, v)}
                      trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                    />
                  </View>
                )}
                <View style={styles.col}>
                  <Switch
                    accessibilityLabel={`${title} emails`}
                    value={settings[`email_${kind}`]}
                    onValueChange={(v) => change(`email_${kind}`, v)}
                    trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                  />
                </View>
              </View>
            ))
          )}
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          Emails go to {user.email}
          {showPush ? '.' : '. Push notifications come with the iPhone app.'}
        </ThemedText>
        {error && (
          <ThemedText type="small" style={{ color: theme.accent }}>
            {error}
          </ThemedText>
        )}
        <Button title="Send me a test notification" variant="secondary" onPress={runTest} loading={testing} />
        {testMessage && <ThemedText type="small">{testMessage}</ThemedText>}
      </Section>

      <Section title="Sign-in">
        <ThemedView type="backgroundElement" style={styles.card}>
          <SignInOptions />
        </ThemedView>
      </Section>

      <PrivacySettings />

      <Button title="Sign out" variant="secondary" onPress={confirmSignOut} loading={signingOut} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: -Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1, gap: Spacing.half },
  col: { width: 56, alignItems: 'center', textAlign: 'center' },
});

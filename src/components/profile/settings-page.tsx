import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { SignInOptions } from '@/components/auth/sign-in-options';
import { Button, Segmented, ToggleRow } from '@/components/form';
import { AppIconPicker } from '@/components/profile/app-icon-picker';
import { useAiConsent } from '@/lib/ai-consent';
import { PrivacySettings } from '@/components/profile/privacy-settings';
import { Screen } from '@/components/screen';
import { SheetActions } from '@/components/profile/pager';
import { ThemedText } from '@/components/themed-text';
import { Card, Group, Row, Section } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { setThemePref, useThemePref, type ThemePref } from '@/lib/theme-preference';
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
  { kind: 'friends', title: 'Friends', detail: 'Friend requests and when someone accepts yours' },
];

/** "0.1.0 (49)": app version plus the build number the TestFlight build was stamped with. */
const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode;
const version = `${Constants.expoConfig?.version ?? ''}${build ? ` (${build})` : ''}`.trim();

export function SettingsPage() {
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
      <Screen title="Settings" embedded action={<SheetActions to="profile" />}>
        <ThemedText>Sign in to change your settings.</ThemedText>
        <Button title="Sign in" onPress={() => router.navigate('/profile')} />
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
    <Screen title="Settings" embedded action={<SheetActions to="profile" />}>
      <Section title="Notifications">
        {showPush && push !== 'on' && (
          <Card>
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
          </Card>
        )}

        <Group>
          <Row style={styles.headerRow}>
            <View style={styles.flex} />
            {showPush && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
                Push
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
              Email
            </ThemedText>
          </Row>
          {settings === null ? (
            <Row>
              <ActivityIndicator />
            </Row>
          ) : (
            KINDS.map(({ kind, title, detail }) => (
              <Row key={kind} style={styles.row}>
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
              </Row>
            ))
          )}
        </Group>
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

      <AppearanceSettings />

      <AppIconPicker />

      <Section title="Sign-in">
        <Card>
          <SignInOptions />
        </Card>
      </Section>

      <AiSettings />

      <PrivacySettings />

      <Button title="Sign out" variant="secondary" onPress={confirmSignOut} loading={signingOut} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.version} selectable>
        Belay Buddy {version}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1, gap: Spacing.half },
  version: { textAlign: 'center' },
  col: { width: 56, alignItems: 'center', textAlign: 'center' },
});

/** Light, dark, or follow the phone. The sun/moon button at the top of each screen flips it quickly. */
function AppearanceSettings() {
  const pref = useThemePref();
  return (
    <Section title="Appearance">
      <Card style={{ padding: Spacing.three, gap: Spacing.two, borderRadius: Spacing.three }}>
        <Segmented<ThemePref>
          label="Display mode"
          value={pref}
          onChange={setThemePref}
          options={[
            { value: 'system', label: 'Match my phone' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>
    </Section>
  );
}

/** The AI choice (Route AI photo check and technique tips) and a link to the privacy policy. */
function AiSettings() {
  const theme = useTheme();
  const { consent, set, signedIn } = useAiConsent();
  return (
    <Section title="AI features">
      <Card style={{ padding: Spacing.three, gap: Spacing.two, borderRadius: Spacing.three }}>
        <ToggleRow
          label="Use AI for Route AI photos and tips"
          value={consent === 'allowed'}
          onValueChange={(on) => set(on ? 'allowed' : 'denied')}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {signedIn
            ? 'When on, Route AI sends your wall photo to an AI service (Anthropic’s Claude) to describe it and write technique tips. Photos and tips are not stored by us. Finding holds and LiDAR measuring stay on your phone either way.'
            : 'Sign in to use AI features. Finding holds and LiDAR measuring work without them.'}
        </ThemedText>
        <Link href="/about" asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              About Belay Buddy
            </ThemedText>
          </Pressable>
        </Link>
        <Link href="/privacy" asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Privacy policy
            </ThemedText>
          </Pressable>
        </Link>
        <Link href="/terms" asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Terms of use
            </ThemedText>
          </Pressable>
        </Link>
      </Card>
    </Section>
  );
}

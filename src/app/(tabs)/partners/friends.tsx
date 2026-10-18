import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Field, ToggleRow } from '@/components/form';
import { CodeScanner } from '@/components/friends/code-scanner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveRefresh } from '@/lib/live';
import { useAuth } from '@/lib/auth';
import {
  addFriendByCode,
  fetchDiscoverable,
  findClimbers,
  formatUntil,
  friendLink,
  myFriendCode,
  removeFriendship,
  requestFriend,
  respondToRequest,
  saveDiscoverable,
  takePendingCode,
  useFriends,
  type Climber,
  type Friend,
} from '@/lib/friends';
import { useHomeGyms } from '@/lib/home-gyms';

function describeAdd(status: string, name: string): string {
  if (status === 'accepted') return `You and ${name} are now friends.`;
  if (status === 'already') return `You and ${name} are already friends.`;
  if (status === 'invalid') return 'That code did not work. Check it and try again.';
  return `Request sent to ${name}. They need to accept it.`;
}

export default function FriendsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { friends, incoming, outgoing, loading, error, refresh } = useFriends();

  useLiveRefresh(['friendships', 'checkins'], () => refresh(true), Boolean(user));

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // A code from a link opened before signing in.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const code = takePendingCode();
    if (!code) return;
    addFriendByCode(code)
      .then((r) => {
        setNotice(describeAdd(r.status, r.name));
        refresh();
      })
      .catch((e: Error) => setNotice(e.message));
  }, [user, refresh]);

  if (authLoading) {
    return (
      <Screen title="Friends" showTitle={false} onRefresh={refresh}>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="Friends" showTitle={false} onRefresh={refresh}>
        <ThemedText type="subtitle" accessibilityRole="header">Friends</ThemedText>
        <ThemedText>Sign in to add friends and see when they are at the gym.</ThemedText>
        <Button title="Sign in" onPress={() => router.push('/profile')} />
      </Screen>
    );
  }

  return (
    <Screen title="Friends" showTitle={false} onRefresh={refresh}>
      <View>
        <ThemedText type="subtitle" accessibilityRole="header">Friends</ThemedText>
        <ThemedText themeColor="textSecondary">
          Friends can see when you check in at a gym. Nothing else about where you are.
        </ThemedText>
      </View>
      {notice && <ThemedText type="smallBold">{notice}</ThemedText>}
      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

      {incoming.length > 0 && (
        <Card>
          <ThemedText type="smallBold">Requests</ThemedText>
          {incoming.map((f) => (
            <RequestRow key={f.friendshipId} friend={f} onChange={refresh} />
          ))}
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">Your friends</ThemedText>
        {loading && friends.length === 0 ? (
          <ActivityIndicator />
        ) : friends.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No friends yet. Share your code below, or add someone with theirs.
          </ThemedText>
        ) : (
          friends.map((f) => <FriendRow key={f.friendshipId} friend={f} onChange={refresh} />)
        )}
      </Card>

      <MyCode />
      <AddByCode onAdded={refresh} />
      <FindClimbers onAdded={refresh} />

      {outgoing.length > 0 && (
        <Card>
          <ThemedText type="smallBold">Waiting for an answer</ThemedText>
          {outgoing.map((f) => (
            <OutgoingRow key={f.friendshipId} friend={f} onChange={refresh} />
          ))}
        </Card>
      )}

      <Privacy userId={user.id} />
    </Screen>
  );
}

function RequestRow({ friend, onChange }: { friend: Friend; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function answer(accept: boolean) {
    setBusy(true);
    try {
      await respondToRequest(friend.friendshipId, accept);
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.rowBlock}>
      <ThemedText>{friend.name} wants to be friends.</ThemedText>
      <View style={styles.buttons}>
        <View style={styles.flex}><Button title="Accept" onPress={() => answer(true)} loading={busy} /></View>
        <View style={styles.flex}><Button title="Decline" variant="secondary" onPress={() => answer(false)} disabled={busy} /></View>
      </View>
    </View>
  );
}

function FriendRow({ friend, onChange }: { friend: Friend; onChange: () => void }) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  async function remove() {
    await removeFriendship(friend.friendshipId).catch(() => {});
    onChange();
  }
  return (
    <View style={styles.rowBlock}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{friend.name}</ThemedText>
          <ThemedText type="small" style={{ color: friend.checkIn ? theme.accent : theme.textSecondary }}>
            {friend.checkIn
              ? `At ${friend.checkIn.areaName} until ${formatUntil(friend.checkIn.until)}`
              : 'Not checked in'}
          </ThemedText>
        </View>
        <ThemedText
          type="small"
          accessibilityRole="button"
          style={{ color: theme.accent }}
          onPress={() => (confirming ? remove() : setConfirming(true))}>
          {confirming ? 'Tap again to remove' : 'Remove'}
        </ThemedText>
      </View>
    </View>
  );
}

function OutgoingRow({ friend, onChange }: { friend: Friend; onChange: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText style={styles.flex}>{friend.name}</ThemedText>
      <ThemedText
        type="small"
        accessibilityRole="button"
        style={{ color: theme.accent }}
        onPress={async () => {
          await removeFriendship(friend.friendshipId).catch(() => {});
          onChange();
        }}>
        Cancel
      </ThemedText>
    </View>
  );
}

function MyCode() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    myFriendCode().then(setCode).catch(() => setCode(null));
  }, []);

  async function share() {
    if (!code) return;
    const message = `Add me on Belay Buddy: ${friendLink(code)} (or use my friend code ${code})`;
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ text: message }).catch(() => {});
        return;
      }
      await Clipboard.setStringAsync(message);
    } else {
      await Share.share({ message }).catch(() => {});
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <ThemedText type="smallBold">Your friend code</ThemedText>
      <ThemedText type="subtitle" selectable style={styles.code}>
        {code ? `${code.slice(0, 4)} ${code.slice(4)}` : '…'}
      </ThemedText>
      {code && (
        // Dark on white with a margin, so it scans in both light and dark mode.
        <View style={styles.qr} accessibilityLabel="QR code for your friend link">
          <QRCode value={friendLink(code)} size={168} color="#1F2D35" backgroundColor="#FFFFFF" ecl="M" />
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Let a friend scan this, or send them the link or code. It only lets them send you a request.
      </ThemedText>
      <View style={styles.buttons}>
        <View style={styles.flex}><Button title="Share link" onPress={share} disabled={!code} /></View>
        <View style={styles.flex}><Button title={copied ? 'Copied' : 'Copy code'} variant="secondary" onPress={copy} disabled={!code} /></View>
      </View>
    </Card>
  );
}

function AddByCode({ onAdded }: { onAdded: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function add(value = code) {
    if (busy || value.replace(/\s/g, '').length < 8) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await addFriendByCode(value);
      setMessage(describeAdd(r.status, r.name));
      if (r.status !== 'invalid') {
        setCode('');
        onAdded();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">Add a friend with their code</ThemedText>
      <Field
        label="Friend code"
        placeholder="ABCD 2345"
        value={code}
        onChangeText={(v) => {
          setCode(v.toUpperCase());
          setMessage(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => add()}
      />
      <Button title="Add friend" onPress={() => add()} disabled={code.replace(/\s/g, '').length < 8} loading={busy} />
      {Platform.OS !== 'web' && (
        <>
          <Button title="Scan a friend’s QR code" variant="secondary" onPress={() => setScanning(true)} />
          <CodeScanner
            visible={scanning}
            onClose={() => setScanning(false)}
            onCode={(scanned) => {
              setScanning(false);
              add(scanned);
            }}
          />
        </>
      )}
      {message && <ThemedText type="small">{message}</ThemedText>}
    </Card>
  );
}

function FindClimbers({ onAdded }: { onAdded: () => void }) {
  const { homeGyms } = useHomeGyms();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Climber[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (homeGyms.length === 0) {
    return (
      <Card>
        <ThemedText type="smallBold">Find climbers at your gyms</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Set a home gym (open a gym in Find and tap “Home gym”) to search for climbers who climb there too.
        </ThemedText>
      </Card>
    );
  }

  async function search() {
    if (query.trim().length < 2) return;
    setBusy(true);
    setMessage(null);
    try {
      setResults(await findClimbers(query));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function add(c: Climber) {
    try {
      const status = await requestFriend(c.id);
      setMessage(describeAdd(status, c.name));
      setResults((r) => r?.filter((x) => x.id !== c.id) ?? null);
      onAdded();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">Find climbers at your gyms</ThemedText>
      <Field
        label="Name"
        placeholder="Search by name"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={search}
      />
      <Button title="Search" variant="secondary" onPress={search} disabled={query.trim().length < 2} loading={busy} />
      {results && results.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No one found. They need a home gym in common with you and “Find me by name” on.
        </ThemedText>
      )}
      {results?.map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{c.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{c.sharedGym}</ThemedText>
          </View>
          <Button title="Add" variant="secondary" onPress={() => add(c)} />
        </View>
      ))}
      {message && <ThemedText type="small">{message}</ThemedText>}
    </Card>
  );
}

function Privacy({ userId }: { userId: string }) {
  const [on, setOn] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetchDiscoverable(userId)
      .then(setOn)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userId]);

  return (
    <Card>
      <ToggleRow
        label="Let climbers at my home gyms find me by name"
        value={on}
        onValueChange={(v) => {
          if (!loaded) return;
          setOn(v);
          saveDiscoverable(userId, v).catch(() => setOn(!v));
        }}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Only your display name is shown, and only to people who share a home gym with you. Turn it off to be added only with your code.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { color: '#C0392B' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowBlock: { gap: Spacing.two, paddingVertical: Spacing.one },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  code: { letterSpacing: 2 },
  qr: { alignSelf: 'center', padding: Spacing.three, backgroundColor: '#FFFFFF', borderRadius: Spacing.three },
});

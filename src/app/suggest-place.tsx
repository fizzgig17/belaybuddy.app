import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Segmented } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { getDeviceLocation, LocationDeniedError, searchPlaces } from '@/lib/location';
import { submitPlace, type PossibleMatch, type SubmissionKind } from '@/lib/place-submissions';
import type { LatLng } from '@/types/models';

const KINDS: { value: SubmissionKind; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'crag', label: 'Crag' },
  { value: 'shop', label: 'Shop' },
];

/** "Missing a gym or crag? Tell us." Signed-in people send details; the owner reviews each one. */
export default function SuggestPlaceScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { kind: startKind } = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<SubmissionKind>(startKind === 'shop' || startKind === 'crag' ? startKind : 'gym');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [pointLabel, setPointLabel] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ match: PossibleMatch | null } | null>(null);

  async function findAddress() {
    if (!address.trim()) {
      setError('Type an address or town first.');
      return;
    }
    setLocating(true);
    setError(null);
    try {
      const found = await searchPlaces(address);
      if (found.length === 0) {
        setPoint(null);
        setPointLabel(null);
        setError('We could not find that address. Try adding the town and state, or use your current location.');
      } else {
        setPoint(found[0].point);
        setPointLabel(found[0].label);
      }
    } catch {
      setError('The address lookup is not working right now. You can still send this without a location.');
    } finally {
      setLocating(false);
    }
  }

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    try {
      const here = await getDeviceLocation();
      setPoint(here);
      setPointLabel('Your current location');
    } catch (e) {
      setError(
        e instanceof LocationDeniedError ? 'Location is off for Belay Buddy. Type the address instead.' : 'Could not get your location. Type the address instead.',
      );
    } finally {
      setLocating(false);
    }
  }

  async function send() {
    if (name.trim().length < 2) {
      setError('Give the place a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await submitPlace({
        kind,
        name,
        address,
        point: point ?? undefined,
        website,
        phone,
        hoursText: hours,
        notes,
        searchedFor,
      });
      setDone({ match: res.possibleMatch });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <Stack.Screen options={{ headerShown: Platform.OS !== 'web', title: 'Suggest a place', headerBackTitle: 'Back' }} />
  );

  if (done) {
    return (
      <Screen title="Thanks" description="Tell Belay Buddy about a missing gym, crag or shop." showTitle={Platform.OS === 'web'} readable>
        {header}
        <ThemedText type="subtitle" accessibilityRole="header">
          Thanks, we got it
        </ThemedText>
        {done.match ? (
          <ThemedText>
            We may already have “{done.match.name}”
            {done.match.distanceKm != null ? ` (${Math.round(done.match.distanceKm * 1000)} m from your pin)` : ''}. Try
            searching for that name in Find, and raise the distance if it does not show. We will still look at what you sent.
          </ThemedText>
        ) : (
          <ThemedText>We will check it and add it if it is right. This can take a few days.</ThemedText>
        )}
        <Link href="/" asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Back to Find
            </ThemedText>
          </Pressable>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen
      title="Suggest a place"
      subtitle="Missing a gym, crag or shop? Tell us what you know."
      description="Tell Belay Buddy about a climbing gym, crag or shop that is missing, and we will add it."
      showTitle={Platform.OS === 'web'}
      readable>
      {header}
      {Platform.OS !== 'web' && (
        <ThemedText type="subtitle" accessibilityRole="header">
          Suggest a place
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        The more you tell us, the faster we can add it. We check each one before it shows up for everyone.
      </ThemedText>
      {!user ? (
        <Link href="/profile" asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Sign in to suggest a place
            </ThemedText>
          </Pressable>
        </Link>
      ) : (
        <View style={styles.form}>
          <Segmented label="What is it" value={kind} onChange={setKind} options={KINDS} />
          <Field label="Name" value={name} onChangeText={setName} placeholder="Name of the gym, crag or shop" maxLength={200} />
          <Field
            label="Address or town"
            value={address}
            onChangeText={(t) => {
              setAddress(t);
              setPoint(null);
              setPointLabel(null);
            }}
            placeholder="Street address, or the town for a crag"
            maxLength={300}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Find on map" variant="secondary" onPress={findAddress} loading={locating} />
            </View>
            {Platform.OS !== 'web' && (
              <View style={styles.flex}>
                <Button title="I'm here now" variant="secondary" onPress={useMyLocation} loading={locating} />
              </View>
            )}
          </View>
          {pointLabel && (
            <ThemedText type="small" themeColor="textSecondary">
              Location set: {pointLabel}
            </ThemedText>
          )}
          <Field label="Website (optional)" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" maxLength={300} />
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} />
          <Field label="Opening hours (optional)" value={hours} onChangeText={setHours} placeholder="Mon-Fri 6am-10pm, Sat-Sun 9am-8pm" maxLength={400} />
          <Field
            label="What did you search for? (optional)"
            value={searchedFor}
            onChangeText={setSearchedFor}
            placeholder="So we can see why it did not show"
            maxLength={200}
          />
          <Field label="Anything else (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1500} />
          {error && (
            <ThemedText type="small" style={{ color: '#C0392B' }} accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          )}
          <Button title="Send for review" onPress={send} loading={busy} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});

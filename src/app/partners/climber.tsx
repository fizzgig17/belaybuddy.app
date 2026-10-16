import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';

import { Button, Field, SingleChoice } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { HoldColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  blockClimber,
  displayName,
  fetchCards,
  isNewMember,
  REPORT_REASONS,
  reportClimber,
  WEIGHT_HINT_TEXT,
  type ReportReason,
} from '@/lib/partners';
import type { ClimberCard } from '@/types/models';

const STYLE_LABELS: Record<string, string> = {
  bouldering: 'Bouldering',
  'top-rope': 'Top rope',
  lead: 'Lead',
  trad: 'Trad',
  multipitch: 'Multipitch',
  ice: 'Ice',
};

export default function ClimberScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { id, post } = useLocalSearchParams<{ id: string; post?: string }>();
  const [card, setCard] = useState<ClimberCard | null | undefined>(undefined);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('unsafe-belay');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    fetchCards([id])
      .then((cards) => setCard(cards.get(id) ?? null))
      .catch(() => setCard(null));
  }, [user, id]);

  if (!user) return null;
  if (card === undefined) {
    return (
      <Screen title="Climber" showTitle={false}>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    );
  }
  if (!card) {
    return (
      <Screen title="Climber" showTitle={false}>
        <ThemedText>{notice ?? "This climber's profile isn't available."}</ThemedText>
      </Screen>
    );
  }

  const name = displayName(card);
  const isMe = card.userId === user.id;
  const memberSince = new Date(card.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  async function block() {
    setBusy(true);
    try {
      await blockClimber(card!.userId, card!.displayName);
      setCard(null);
      setNotice(`You blocked ${name}. You won't see each other's posts, profiles or chats. Unblock from Profile.`);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock() {
    const title = `Block ${name}?`;
    const message = "You won't see each other's posts, profiles or chats anywhere in Belay Buddy.";
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n\n${message}`)) block();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: block },
    ]);
  }

  async function submitReport() {
    setBusy(true);
    try {
      await reportClimber(card!.userId, reason, details, post);
      setReporting(false);
      setDetails('');
      setNotice('Thanks. A person will review this report privately. If you feel unsafe, also tell the gym staff.');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={name} showTitle={false}>
      <View style={styles.heading}>
        <SymbolView name={Icons.person} size={56} tintColor={theme.textSecondary} />
        <View style={styles.flex}>
          <ThemedText type="subtitle">{name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {isNewMember(card) ? 'New member' : `Member since ${memberSince}`}
            {card.homeArea ? ` · ${card.homeArea}` : ''}
          </ThemedText>
        </View>
      </View>

      {card.bio && <ThemedText>{card.bio}</ThemedText>}

      <ThemedView type="backgroundElement" style={styles.card}>
        {card.styles.length > 0 && (
          <Row label="Climbs" value={card.styles.map((s) => STYLE_LABELS[s] ?? s).join(', ')} />
        )}
        {(card.routeGrade || card.boulderGrade) && (
          <Row label="Grades" value={[card.routeGrade, card.boulderGrade].filter(Boolean).join(' · ')} />
        )}
        {card.yearsClimbing != null && (
          <Row label="Experience" value={`${card.yearsClimbing} ${card.yearsClimbing === 1 ? 'year' : 'years'}`} />
        )}
        <Row
          label="Belay skills (self-reported)"
          value={
            card.belayCertified.length
              ? card.belayCertified.map((b) => (b === 'lead' ? 'Lead belay' : 'Top-rope belay')).join(', ')
              : 'None listed'
          }
        />
        {card.assistedBraking && <Row label="Device" value="Comfortable with an assisted-braking device" />}
      </ThemedView>

      {card.weightHint && (
        <ThemedView type="backgroundElement" style={styles.hint}>
          <SymbolView
            name={Icons.scale}
            size={20}
            tintColor={card.weightHint === 'similar' ? HoldColors.green : HoldColors.yellow}
          />
          <View style={styles.flex}>
            <ThemedText type="small">{WEIGHT_HINT_TEXT[card.weightHint]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Based on weights you both chose to add; neither is shown. Guidance only, not a substitute for
              instruction.
            </ThemedText>
          </View>
        </ThemedView>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Belay skills are self-reported. Always do a partner check, and watch a new partner's first belay closely.
      </ThemedText>

      {notice && <ThemedText type="small">{notice}</ThemedText>}

      {!isMe &&
        (reporting ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Report {name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Reports are private. {name} isn't told who reported them.
            </ThemedText>
            <SingleChoice label="Reason" value={reason} onChange={setReason} options={REPORT_REASONS} />
            <Field
              label="What happened (optional)"
              value={details}
              onChangeText={setDetails}
              maxLength={1000}
              multiline
              style={{ backgroundColor: theme.background }}
            />
            <Button title="Send report" onPress={submitReport} loading={busy} />
            <Button title="Cancel" variant="secondary" onPress={() => setReporting(false)} />
          </ThemedView>
        ) : (
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="Report" variant="secondary" onPress={() => setReporting(true)} />
            </View>
            <View style={styles.flex}>
              <Button title="Block" variant="secondary" onPress={confirmBlock} loading={busy} />
            </View>
          </View>
        ))}

      {isMe && <Button title="Edit your profile" variant="secondary" onPress={() => router.push('/profile')} />}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: Spacing.five },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  hint: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  row: { gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.three },
});

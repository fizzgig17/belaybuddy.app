import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, ChipGroup, Field, ToggleRow } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchMyProfile, updateMyProfile, type ProfileUpdate } from '@/lib/profiles';
import type { BelayCert, ClimberProfile, ClimbingStyle } from '@/types/models';

const STYLE_OPTIONS: { value: ClimbingStyle; label: string }[] = [
  { value: 'bouldering', label: 'Bouldering' },
  { value: 'top-rope', label: 'Top rope' },
  { value: 'lead', label: 'Lead' },
  { value: 'trad', label: 'Trad' },
  { value: 'multipitch', label: 'Multipitch' },
  { value: 'ice', label: 'Ice' },
];

const BELAY_OPTIONS: { value: BelayCert; label: string }[] = [
  { value: 'top-rope', label: 'Top-rope belay' },
  { value: 'lead', label: 'Lead belay' },
];

const GEAR_LABELS: Record<keyof ClimberProfile['hasGear'], string> = {
  rope: 'Rope',
  quickdraws: 'Quickdraws',
  rack: 'Trad rack',
  crashPad: 'Crash pad',
};

type Draft = Omit<ProfileUpdate, 'yearsClimbing' | 'weightKg'> & { yearsClimbing: string; weightLb: string };

const LB_PER_KG = 2.20462;
// Weight is stored rounded to 5 kg (see the partners migration), shown in lb.
const kgToLb = (kg: number) => String(Math.round((kg * LB_PER_KG) / 5) * 5);
const lbToKg = (lb: number) => Math.min(200, Math.max(20, Math.round(lb / LB_PER_KG / 5) * 5));

function toDraft(profile: ClimberProfile): Draft {
  return {
    displayName: profile.displayName ?? '',
    bio: profile.bio ?? '',
    homeArea: profile.homeArea ?? '',
    styles: profile.styles,
    boulderGrade: profile.boulderGrade ?? '',
    routeGrade: profile.routeGrade ?? '',
    yearsClimbing: profile.yearsClimbing?.toString() ?? '',
    hasGear: profile.hasGear,
    belayCertified: profile.belayCertified,
    assistedBraking: profile.assistedBraking,
    weightLb: profile.weightKg ? kgToLb(profile.weightKg) : '',
  };
}

export function ProfileEditor({ userId }: { userId: string }) {
  const theme = useTheme();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyProfile(userId)
      .then((profile) => active && setDraft(toDraft(profile)))
      .catch((e: Error) => active && setMessage({ kind: 'error', text: e.message }));
    return () => {
      active = false;
    };
  }, [userId]);

  if (!draft) {
    return message ? (
      <ThemedText style={{ color: theme.accent }}>Couldn't load your profile: {message.text}</ThemedText>
    ) : (
      <ActivityIndicator />
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft({ ...draft, [key]: value });
    setMessage(null);
  };

  const years = draft.yearsClimbing.trim();
  const yearsValid = years === '' || (/^\d{1,2}$/.test(years) && Number(years) <= 90);
  const weight = draft.weightLb.trim();
  const weightValid = weight === '' || (/^\d{2,3}$/.test(weight) && Number(weight) >= 50 && Number(weight) <= 440);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const { weightLb: _lb, ...rest } = draft;
      const saved = await updateMyProfile(userId, {
        ...rest,
        yearsClimbing: years === '' ? undefined : Number(years),
        weightKg: weight === '' ? undefined : lbToKg(Number(weight)),
      });
      setDraft(toDraft(saved));
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Field
        label="Display name"
        value={draft.displayName}
        onChangeText={(v) => set('displayName', v)}
        maxLength={50}
        autoComplete="nickname"
      />
      <Field
        label="Home area"
        placeholder="Raleigh, NC"
        hint="Shown to partners instead of your location."
        value={draft.homeArea}
        onChangeText={(v) => set('homeArea', v)}
        maxLength={100}
      />
      <Field
        label="About you"
        value={draft.bio}
        onChangeText={(v) => set('bio', v)}
        maxLength={500}
        multiline
      />

      <ChipGroup label="What you climb" options={STYLE_OPTIONS} selected={draft.styles} onChange={(v) => set('styles', v)} />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Field
            label="Boulder grade"
            placeholder="V4"
            value={draft.boulderGrade}
            onChangeText={(v) => set('boulderGrade', v)}
            maxLength={10}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Route grade"
            placeholder="5.10b"
            value={draft.routeGrade}
            onChangeText={(v) => set('routeGrade', v)}
            maxLength={10}
            autoCapitalize="none"
          />
        </View>
      </View>
      <Field
        label="Years climbing"
        value={draft.yearsClimbing}
        onChangeText={(v) => set('yearsClimbing', v)}
        keyboardType="number-pad"
        maxLength={2}
        hint={yearsValid ? undefined : 'Enter a number from 0 to 90.'}
      />

      <ChipGroup
        label="Belay certifications"
        options={BELAY_OPTIONS}
        selected={draft.belayCertified}
        onChange={(v) => set('belayCertified', v)}
      />

      <ThemedView type="backgroundElement" style={styles.gear}>
        <ThemedText type="smallBold">Gear you own</ThemedText>
        {(Object.keys(GEAR_LABELS) as (keyof Draft['hasGear'])[]).map((key) => (
          <ToggleRow
            key={key}
            label={GEAR_LABELS[key]}
            value={draft.hasGear[key]}
            onValueChange={(value) => set('hasGear', { ...draft.hasGear, [key]: value })}
          />
        ))}
      </ThemedView>

      <View style={styles.section}>
        <ThemedText type="smallBold">Partner matching</ThemedText>
        <ToggleRow
          label="Comfortable belaying with an assisted-braking device (GriGri etc.)"
          value={draft.assistedBraking}
          onValueChange={(v) => set('assistedBraking', v)}
        />
        <Field
          label="Weight in lb (optional, private)"
          value={draft.weightLb}
          onChangeText={(v) => set('weightLb', v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          hint={
            weightValid
              ? 'Never shown to anyone. Rounded and used only to show partners a lead weight-match hint. Clear it to delete it.'
              : 'Enter a weight from 50 to 440 lb, or leave it empty.'
          }
        />
      </View>

      <Button title="Save profile" onPress={save} loading={saving} disabled={!yearsValid || !weightValid} />
      {message && (
        <ThemedText
          type="small"
          accessibilityLiveRegion="polite"
          style={message.kind === 'error' ? { color: theme.accent } : undefined}
          themeColor={message.kind === 'ok' ? 'textSecondary' : undefined}>
          {message.text}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  flex: { flex: 1 },
  section: { gap: Spacing.two },
  gear: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});

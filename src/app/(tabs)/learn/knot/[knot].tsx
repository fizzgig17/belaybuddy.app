import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { KnotPlayer } from '@/components/knots/knot-player';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { getKnot, KNOTS } from '@/content/knots';

/** Website: pre-render a page per knot. */
export async function generateStaticParams(): Promise<Record<string, string>[]> {
  return KNOTS.map((k) => ({ knot: k.id }));
}

export default function KnotScreen() {
  const { knot: id } = useLocalSearchParams<{ knot: string }>();
  const knot = getKnot(id);

  if (!knot) {
    return (
      <Screen title="Not found" showTitle={false}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <ThemedText>That knot isn't here yet.</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen title={knot.title} showTitle={false}>
      <Stack.Screen options={{ title: knot.title }} />
      <ThemedText type="subtitle" accessibilityRole="header">
        {knot.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{knot.summary}</ThemedText>
      <KnotPlayer knot={knot} />
      <Card style={styles.note}>
        <ThemedText type="smallBold">Draft, not yet reviewed</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          This animation is a learning aid and hasn't been checked by an instructor yet. Always have a qualified
          partner check your knot before every climb, and learn knots in person from an instructor.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { gap: Spacing.one },
});

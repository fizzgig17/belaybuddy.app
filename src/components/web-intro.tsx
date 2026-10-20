import { StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Website only, for visitors who are not signed in: what Belay Buddy does, before they search. */
export function WebIntro() {
  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" accessibilityRole="header">
        What you can do here
      </ThemedText>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <FeatureCard
            icon="gym"
            title="Find gyms and crags"
            description="Search any town, park or zip code. See distance, climbing styles and opening hours."
          />
        </View>
        <View style={styles.cell}>
          <FeatureCard
            icon="holdMap"
            title="Climb with a partner"
            description="Post when you will be at your gym and see who else is coming."
            href="/partners"
          />
        </View>
        <View style={styles.cell}>
          <FeatureCard
            icon="safety"
            title="Learn the basics"
            description="Partner checks, belaying, gear care and knots, with the sources linked."
            href="/learn"
          />
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        The iPhone and Android apps are in testing. This website works in any browser.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three, marginTop: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  cell: { flexGrow: 1, flexBasis: 260 },
});

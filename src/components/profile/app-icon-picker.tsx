import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Section } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appIconsSupported, chooseAppIcon, currentAppIcon, type AppIconChoice } from '@/lib/app-icon';

const ICONS: { choice: AppIconChoice; label: string; source: number }[] = [
  { choice: 'A', label: 'Teal', source: require('@/assets/icons/icon-a.png') },
  { choice: 'B', label: 'Chalk', source: require('@/assets/icons/icon-b.png') },
  { choice: 'C', label: 'Night', source: require('@/assets/icons/icon-c.png') },
];

/** Lets the climber pick which app icon shows on their home screen (iPhone and Android only). */
export function AppIconPicker() {
  const theme = useTheme();
  const [selected, setSelected] = useState<AppIconChoice>(currentAppIcon);
  const [error, setError] = useState<string | null>(null);

  if (!appIconsSupported) return null;

  async function pick(choice: AppIconChoice) {
    const before = selected;
    setSelected(choice);
    setError(null);
    try {
      await chooseAppIcon(choice);
    } catch (e) {
      setSelected(before);
      setError((e as Error).message);
    }
  }

  return (
    <Section title="App icon">
      <Card>
      <View style={styles.row}>
        {ICONS.map(({ choice, label, source }) => {
          const on = selected === choice;
          return (
            <Pressable
              key={choice}
              accessibilityRole="button"
              accessibilityLabel={`${label} app icon`}
              accessibilityState={{ selected: on }}
              onPress={() => pick(choice)}
              style={styles.option}>
              <View style={[styles.frame, { borderColor: on ? theme.accent : 'transparent' }]}>
                <Image source={source} style={styles.icon} />
              </View>
              <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {error && (
        <ThemedText type="small" style={{ color: theme.accent }}>
          {error}
        </ThemedText>
      )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three },
  option: { alignItems: 'center', gap: Spacing.one },
  frame: { padding: 4, borderWidth: 3, borderRadius: 22 },
  icon: { width: 72, height: 72, borderRadius: 16 },
});

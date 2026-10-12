import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Labeled text field. */
export function Field({
  label,
  hint,
  style,
  ...inputProps
}: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement },
          inputProps.multiline && styles.multiline,
          style,
        ]}
        {...inputProps}
      />
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.backgroundElement },
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : theme.text} />
      ) : (
        <>
          {icon}
          <ThemedText type="smallBold" style={{ color: primary ? '#fff' : theme.text }}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

/** Multi-select chip group. */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() =>
                onChange(on ? selected.filter((v) => v !== option.value) : [...selected, option.value])
              }
              style={[
                styles.chip,
                { backgroundColor: on ? theme.accentSoft : theme.backgroundElement },
                on && { borderColor: theme.accent },
              ]}>
              <ThemedText type="small" style={on ? { color: theme.accent } : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <ThemedText type="small">{label}</ThemedText>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
});

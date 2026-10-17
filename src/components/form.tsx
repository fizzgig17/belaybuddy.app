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
import { select, tap } from '@/lib/haptics';

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
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.backgroundElement },
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.onAccent : theme.text} />
      ) : (
        <>
          {icon}
          <ThemedText type="smallBold" style={{ color: primary ? theme.onAccent : theme.text }}>
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
                {
                  select();
                  onChange(on ? selected.filter((v) => v !== option.value) : [...selected, option.value]);
                }
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

/** Single-select chips, for choices with long or many labels. */
export function SingleChoice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  showLabel = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  showLabel?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {showLabel && <ThemedText type="smallBold">{label}</ThemedText>}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                select();
                onChange(option.value);
              }}
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
      <ThemedText type="small" style={styles.toggleLabel}>
        {label}
      </ThemedText>
      <Switch value={value} onValueChange={(v) => {
          select();
          onValueChange(v);
        }}
        trackColor={{ true: theme.accent, false: theme.backgroundSelected }} />
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
  toggleLabel: { flex: 1 },
  toggleRow: {
    gap: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
});

/** Single-choice segmented control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Accessibility label for the group. */
  label: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[segStyles.group, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
                select();
                onChange(option.value);
              }}
            style={[segStyles.segment, on && { backgroundColor: theme.background }]}>
            <ThemedText
              type={on ? 'smallBold' : 'small'}
              style={{ color: on ? theme.accent : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: Spacing.two + 2, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.two,
  },
});

import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  Platform,
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

/** Keyboards with no Return key (and multiline fields) get a "Done" bar above the keyboard on iPhone. */
export const DONE_BAR_ID = 'bb-done-bar';

/** Render once per screen (Screen does this). */
export function KeyboardDoneBar() {
  const theme = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_BAR_ID}>
      <View style={[styles.doneBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Done
          </ThemedText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

/** Labeled text field. */
export function Field({
  label,
  hint,
  style,
  trailing,
  ...inputProps
}: TextInputProps & { label: string; hint?: string; /** A control drawn inside the right end of the box (a scan button, say). */ trailing?: ReactNode }) {
  const theme = useTheme();
  // On a phone, a swipe that starts on a multiline box (such as one inside the Profile/Settings
  // pager) must not open the keyboard. The box only takes focus from a real tap.
  const tapToEdit = !!inputProps.multiline && Platform.OS !== 'web' && inputProps.editable !== false;
  const [armed, setArmed] = useState(false);
  const ref = useRef<TextInput>(null);
  const field = (
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement },
          inputProps.multiline && styles.multiline,
          trailing ? styles.withTrailing : null,
          style,
        ]}
        // Single-line text fields: Return closes the keyboard unless the caller set something else.
        returnKeyType={inputProps.multiline ? undefined : 'done'}
        inputAccessoryViewID={
          Platform.OS === 'ios' && (inputProps.multiline || /number|decimal|phone/.test(inputProps.keyboardType ?? ''))
            ? DONE_BAR_ID
            : undefined
        }
        {...inputProps}
        editable={tapToEdit ? armed : inputProps.editable}
        onBlur={(e) => {
          setArmed(false);
          inputProps.onBlur?.(e);
        }}
      />
  );
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {tapToEdit ? (
        <View>
          {field}
          {!armed && (
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${label}`}
              onPress={() => {
                setArmed(true);
                setTimeout(() => ref.current?.focus(), 0);
              }}
            />
          )}
        </View>
      ) : trailing ? (
        <View>
          {field}
          <View style={styles.trailing}>{trailing}</View>
        </View>
      ) : (
        field
      )}
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
  withTrailing: { paddingRight: 52 },
  trailing: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  field: { gap: Spacing.one },
  doneBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
              style={{ color: on ? theme.accent : theme.textSecondary, textAlign: 'center' }}>
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
    justifyContent: 'center',
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.two,
  },
});

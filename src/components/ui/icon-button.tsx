import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icons, type IconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Round icon button with a tooltip: hover on the website, press and hold on a phone.
 * The label is also read by screen readers.
 */
export function IconButton({ icon, label, onPress, tipAbove = false }: { icon: IconName; label: string; onPress: () => void; tipAbove?: boolean }) {
  const theme = useTheme();
  const [tip, setTip] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function flash() {
    setTip(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTip(false), 1800);
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        onLongPress={flash}
        onHoverIn={() => setTip(true)}
        onHoverOut={() => setTip(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={(state) => {
          const hovered = (state as { hovered?: boolean }).hovered === true;
          return [
            styles.button,
            { backgroundColor: hovered ? theme.accentSoft : theme.surface, borderColor: hovered ? theme.accent : theme.border },
            Platform.OS === 'web' && ({ transitionProperty: 'background-color, border-color', transitionDuration: '140ms', cursor: 'pointer' } as object),
            state.pressed && styles.pressed,
          ];
        }}>
        <SymbolView name={Icons[icon]} size={22} tintColor={theme.accent} />
      </Pressable>
      {tip && (
        tipAbove ? (
          // Centered over the button and above it, so a finger never covers it.
          <View pointerEvents="none" style={styles.tipAboveWrap}>
            <View style={[styles.tipAbove, { backgroundColor: theme.text }]}>
              <ThemedText type="small" style={{ color: theme.background }} numberOfLines={1}>
                {label}
              </ThemedText>
            </View>
          </View>
        ) : (
          // A wide wrapper: on a phone an absolute child is only as wide as the 40pt button, which cut the label to "Star…".
          <View pointerEvents="none" style={styles.tipBelowWrap}>
            <View style={[styles.tipAbove, { backgroundColor: theme.text }]}>
              <ThemedText type="small" style={{ color: theme.background }} numberOfLines={1}>
                {label}
              </ThemedText>
            </View>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  button: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  tipAboveWrap: { position: 'absolute', bottom: 46, left: -80, width: 200, alignItems: 'center' },
  tipAbove: { paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  tipBelowWrap: { position: 'absolute', top: 46, right: 0, width: 220, alignItems: 'flex-end' },
});

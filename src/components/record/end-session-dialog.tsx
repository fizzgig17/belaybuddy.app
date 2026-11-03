import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Button, ButtonIcon } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { cancelEndSession, endSessionNow, useRecordSheet } from '@/lib/record-sheet';

/** The "End this session?" pop-up: End session or Keep climbing. Ending returns to the start screen. */
export function EndSessionDialog() {
  const { confirmEnd } = useRecordSheet();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (confirmEnd) setShown(true);
    Animated.timing(fade, { toValue: confirmEnd ? 1 : 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !confirmEnd) setShown(false);
    });
  }, [confirmEnd, fade]);

  if (!shown) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: fade }]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={cancelEndSession} accessibilityLabel="Keep climbing" accessibilityRole="button" />
      <View style={styles.center} pointerEvents="box-none">
        <Card raised style={styles.card}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
            End this session?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
            Your climbs are saved to History.
          </ThemedText>
          <Button
            title="End session"
            icon={<ButtonIcon name="stop" />}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await endSessionNow();
              setBusy(false);
            }}
          />
          <Button title="Keep climbing" variant="secondary" icon={<ButtonIcon name="climber" variant="secondary" />} onPress={cancelEndSession} />
        </Card>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: '#00000066', zIndex: 50, elevation: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  card: { width: '100%', maxWidth: 360, gap: Spacing.three },
  title: { textAlign: 'center' },
});

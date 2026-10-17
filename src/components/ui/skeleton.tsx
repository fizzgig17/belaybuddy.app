import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A softly pulsing placeholder block. */
export function Bone({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: theme.backgroundSelected, opacity, borderRadius: 6 }, style]} />;
}

/** Placeholder shaped like a gym/crag row, shown while a list loads. */
export function AreaRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} style={styles.card}>
          <Bone style={styles.badge} />
          <View style={styles.body}>
            <Bone style={{ height: 14, width: '60%' }} />
            <Bone style={{ height: 12, width: '85%' }} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  badge: { width: 36, height: 36, borderRadius: 18 },
  body: { flex: 1, gap: Spacing.two },
});

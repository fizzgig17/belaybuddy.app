import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ClimbBeads } from '@/components/record/climb-beads';
import { SessionBody } from '@/components/record/session-body';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSessionActive, useSessionLogs } from '@/lib/active-session';
import { closeRecordSheet, useRecordSheet } from '@/lib/record-sheet';


/**
 * The record-session sheet. It slides up over the current tab but stops above the tab bar, so the round button stays
 * visible (and becomes End session). It only ever comes up from the bottom. iPhone: a grabber line you can pull down;
 * Android and the website: an X. Rendered next to the tab content by the tab bar layout.
 */
export function RecordSheet() {
  const { open, finished } = useRecordSheet();
  const active = useSessionActive();
  const logs = useSessionLogs();
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(0);
  // Stop where the profile sheet stops: its 0.95 detent leaves 5% of the screen above it.
  const win = useWindowDimensions();
  const panelH = Math.max(0, height - Math.round(win.height * 0.05));
  const y = useRef(new Animated.Value(2000)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(dim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(y, { toValue: panelH || 800, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(dim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pulling the grabber down closes the sheet; letting go early springs it back.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 90 || g.vy > 0.9) closeRecordSheet();
          else Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [y],
  );

  const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const panelStyle = [
    styles.panel,
    { height: panelH, transform: [{ translateY: y }], borderColor: theme.border },
    !glass && { backgroundColor: theme.background + 'F2' },
  ];
  const content = (
    <>
      <View style={styles.grabZone} {...pan.panHandlers} accessibilityLabel="Pull down to close" accessibilityRole="adjustable">
        {Platform.OS === 'ios' ? (
          <View style={[styles.grabber, { backgroundColor: theme.textSecondary }]} />
        ) : (
          <View style={styles.closeRow}>
            <IconButton icon="close" label="Close" onPress={closeRecordSheet} />
          </View>
        )}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <SessionBody />
      </ScrollView>
      {active && !finished && logs.length > 0 && (
        <View style={styles.footer}>
          <ClimbBeads logs={logs} />
        </View>
      )}
    </>
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={mounted ? 'box-none' : 'none'}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {mounted && (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#00000040', opacity: dim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeRecordSheet} accessibilityLabel="Close" accessibilityRole="button" />
          </Animated.View>
          {glass ? (
            <Animated.View style={panelStyle}>
              <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background + '66' }]} pointerEvents="none" />
              {content}
            </Animated.View>
          ) : (
            <Animated.View style={panelStyle}>{content}</Animated.View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabZone: { height: 22, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  closeRow: { position: 'absolute', right: Spacing.three, top: Spacing.two },
  scroll: { flex: 1 },
  footer: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, paddingTop: Spacing.one },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
});

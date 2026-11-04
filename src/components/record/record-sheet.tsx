import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ClimbBeads } from '@/components/record/climb-beads';
import { SessionHistory } from '@/components/record/session-history';
import { SessionBody } from '@/components/record/session-body';
import { Segmented } from '@/components/form';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useSheetTop } from '@/hooks/use-sheet-top';
import { useTheme } from '@/hooks/use-theme';
import { useSessionActive, useSessionLogs } from '@/lib/active-session';
import { closeRecordSheet, setRecordTab, useRecordSheet } from '@/lib/record-sheet';


/**
 * The record-session sheet. It slides up over the current tab but stops above the tab bar, so the round button stays
 * visible (and becomes End session). It only ever comes up from the bottom. iPhone: a grabber line you can pull down;
 * Android and the website: an X. Rendered next to the tab content by the tab bar layout.
 */
export function RecordSheet() {
  const { open, finished, tab } = useRecordSheet();
  const active = useSessionActive();
  const logs = useSessionLogs();
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(0);
  // Same place and look as the profile sheet: it tops out about 13% down the screen, inset a few points from the sides.
  const sheet = useSheetTop();
  const panelH = Math.max(0, height - sheet.top);
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

  const panelStyle = [styles.panel, { height: panelH, transform: [{ translateY: y }], backgroundColor: theme.background }];
  const tabs = finished ? null : (
    <Segmented
      label="Record or history"
      value={tab}
      onChange={setRecordTab}
      options={[
        { value: 'record', label: 'Record' },
        { value: 'history', label: 'History' },
      ]}
    />
  );
  const content = (
    <>
      <View style={[styles.grabZone, Platform.OS !== 'ios' && { height: 8 }]} {...pan.panHandlers} accessibilityLabel="Pull down to close" accessibilityRole="adjustable">
        {Platform.OS === 'ios' && <View style={[styles.grabber, { backgroundColor: theme.textSecondary }]} />}
      </View>
      {Platform.OS !== 'ios' && (
        // Android and web: the tabs sit beside the close button, not under it.
        <View style={styles.androidHeader}>
          <View style={styles.androidTabs}>{tabs}</View>
          <IconButton icon="close" label="Close" onPress={closeRecordSheet} />
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        {Platform.OS === 'ios' && tabs}
        {tab === 'history' && !finished ? <SessionHistory /> : <SessionBody />}
      </ScrollView>
      {active && !finished && tab === 'record' && logs.length > 0 && (
        <View style={styles.footer}>
          <ClimbBeads logs={logs} />
        </View>
      )}
    </>
  );

  return (
    <View
      ref={sheet.ref}
      style={StyleSheet.absoluteFill}
      pointerEvents={mounted ? 'box-none' : 'none'}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
        sheet.onLayout();
      }}>
      {mounted && (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#00000040', opacity: dim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeRecordSheet} accessibilityLabel="Close" accessibilityRole="button" />
          </Animated.View>
          <Animated.View style={panelStyle}>{content}</Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  // Same size and spot as the native grabber on the profile sheet.
  grabZone: { height: 28, alignItems: 'center', justifyContent: 'flex-start' },
  grabber: { width: 58, height: 5, borderRadius: 3, marginTop: 5, opacity: 0.55 },
  androidHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  androidTabs: { flex: 1 },
  scroll: { flex: 1 },
  footer: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, paddingTop: Spacing.one },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
});

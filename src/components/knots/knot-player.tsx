import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Spacing } from '@/constants/theme';
import type { Knot } from '@/content/knots';
import { KNOT_VIEWBOX } from '@/content/knots';
import { useTheme } from '@/hooks/use-theme';
import { strandLayers } from '@/lib/knots/render';

const STEP_MS = 1800;
// Colors of a typical dynamic rope: a blue sheath, and an orange one for the returning tail.
const ROPE_BLUE = '#2F7FD1';
const ROPE_BLUE_DARK = '#10345A';
const ROPE_ORANGE = '#F08A24';
const ROPE_ORANGE_DARK = '#6B3407';

/** Plays a knot step by step: the rope draws itself, with a caption and Back / Next / Replay. */
export function KnotPlayer({ knot }: { knot: Knot }) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const value = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const playing = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mirror the animated value into state so the SVG redraws as the rope grows.
  useEffect(() => {
    const id = value.addListener(({ value: v }) => {
      current.current = v;
      setProgress(v);
      // While playing straight through, the caption follows the rope.
      if (playing.current) setStep(knot.steps.findIndex((st) => v <= st.to + 1e-6));
    });
    return () => value.removeListener(id);
  }, [value, knot]);

  function goTo(index: number, from?: number) {
    playing.current = false;
    setIsPlaying(false);
    const target = knot.steps[index].to;
    setStep(index);
    if (from !== undefined) value.setValue(from);
    Animated.timing(value, {
      toValue: target,
      duration: Math.max(300, Math.abs(target - current.current) * STEP_MS),
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }

  /** Plays the whole sequence from the start without stopping. */
  function playAll() {
    const total = knot.steps[knot.steps.length - 1].to;
    value.stopAnimation();
    value.setValue(0);
    setStep(0);
    playing.current = true;
    setIsPlaying(true);
    Animated.timing(value, {
      toValue: total,
      duration: total * STEP_MS * 1.5,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      playing.current = false;
      setIsPlaying(false);
      setStep(knot.steps.length - 1);
    });
  }

  // Start playing the first step when the knot opens.
  useEffect(() => {
    goTo(0, 0);
    return () => value.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knot.id]);

  const last = step === knot.steps.length - 1;
  const mainFraction = Math.min(progress, 1);
  const retraceFraction = Math.max(0, Math.min(progress - 1, 1));

  const layers = useMemo(
    () =>
      strandLayers(
        [
          { rope: knot.rope, drawn: knot.rope.length * mainFraction, fill: ROPE_BLUE, outline: ROPE_BLUE_DARK },
          ...(knot.retrace
            ? [
                {
                  rope: knot.retrace,
                  drawn: knot.retrace.length * retraceFraction,
                  fill: ROPE_ORANGE,
                  outline: ROPE_ORANGE_DARK,
                },
              ]
            : []),
        ],
      ),
    [knot, mainFraction, retraceFraction, theme],
  );

  return (
    <View style={styles.wrap}>
      <Card style={styles.canvas}>
        <Svg viewBox={`0 0 ${KNOT_VIEWBOX} ${KNOT_VIEWBOX}`} style={styles.svg} accessibilityLabel={`${knot.title} diagram`}>
          {layers.map((l) => (
            <Path
              key={l.key}
              d={l.d}
              stroke={l.stroke}
              strokeWidth={l.width}
              strokeLinecap={l.cap ?? 'round'}
              strokeLinejoin="round"
              strokeOpacity={l.opacity ?? 1}
              strokeDasharray={l.dash}
              transform={l.dx || l.dy ? `translate(${l.dx ?? 0} ${l.dy ?? 0})` : undefined}
              fill="none"
            />
          ))}
        </Svg>
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        Step {step + 1} of {knot.steps.length}
      </ThemedText>
      <ThemedText accessibilityLiveRegion="polite">{knot.steps[step].caption}</ThemedText>

      <View style={styles.buttons}>
        <View style={styles.flex}>
          <Button title="Back" variant="secondary" disabled={step === 0 || isPlaying} onPress={() => goTo(step - 1)} />
        </View>
        <View style={styles.flex}>
          {last && !isPlaying ? (
            <Button title="Replay" onPress={() => goTo(0, 0)} />
          ) : (
            <Button title="Next" disabled={isPlaying} onPress={() => goTo(step + 1)} />
          )}
        </View>
      </View>
      <Button title={isPlaying ? 'Playing…' : 'Play all'} variant="secondary" disabled={isPlaying} onPress={playAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  canvas: { padding: Spacing.two },
  svg: { width: '100%', aspectRatio: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});

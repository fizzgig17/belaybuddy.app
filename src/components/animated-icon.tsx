import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 400;
/** Same color and logo size as the launch screen (app.json, expo-splash-screen), so the handover is invisible. */
const SPLASH_BACKGROUND = '#1F2A2E';
const LOGO_SIZE = 140;

/** Holds the launch screen's look until the app has drawn, then fades it away. */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const fade = new Keyframe({
    0: { opacity: 1 },
    30: { opacity: 1 },
    100: { opacity: 0, easing: Easing.out(Easing.quad) },
  });

  const image = <Image style={styles.image} source={require('@/assets/images/belay-buddy-logo.png')} />;

  return animate ? (
    <Animated.View
      entering={fade.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});

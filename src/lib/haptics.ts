import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const native = Platform.OS === 'ios';

/** A light tap for presses and selections. Silent on the web and Android. */
export function tap() {
  if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** For switches and chip toggles. */
export function select() {
  if (native) Haptics.selectionAsync().catch(() => {});
}

/** Something worked (signed in, saved). */
export function success() {
  if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

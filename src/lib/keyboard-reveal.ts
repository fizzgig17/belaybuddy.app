import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type View } from 'react-native';

/**
 * Android: keep the field you are typing in above the keyboard.
 *
 * With the edge-to-edge window the keyboard can sit on top of a scrolling page instead of shrinking it. This hook
 * measures how much of the page the keyboard covers (zero if the window already shrank), returns that as `overlap`
 * for the caller to add as a bottom margin on the scroll view so the page shrinks to the space above the keyboard, and scrolls the
 * focused field into view when the keyboard opens or you move to another field. Other platforms get zeros.
 */
const listeners = new Set<() => void>();

/** Call from a field's onFocus so moving between fields (the keyboard stays open) also scrolls it into view. */
export function announceFocus() {
  if (Platform.OS === 'android') listeners.forEach((l) => l());
}

export function useKeyboardReveal<T extends ScrollView | View = ScrollView>() {
  const ref = useRef<T>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlapState] = useState(0);
  const overlapNow = useRef(0);
  const setOverlap = (n: number) => {
    overlapNow.current = n;
    setOverlapState(n);
  };

  const reveal = useCallback(() => {
    const top = keyboardTop.current;
    if (top == null) return;
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.();
      const box = ref.current as unknown as ScrollView | null;
      if (!input || !box) return;
      input.measureInWindow((_x, y, _w, h) => {
        const need = y + h + 24 - top;
        if (need > 0) box.scrollTo?.({ y: scrollY.current + need, animated: true });
      });
    }, 120);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      const box = ref.current as unknown as View | null;
      box?.measureInWindow?.((_x, y, _w, h) => {
        // The page may already be pushed up by an earlier overlap; measure what it would cover without it.
        setOverlap(Math.max(0, Math.round(y + h + overlapNow.current - e.endCoordinates.screenY)));
        reveal();
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setOverlap(0);
    });
    listeners.add(reveal);
    return () => {
      show.remove();
      hide.remove();
      listeners.delete(reveal);
    };
  }, [reveal]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { ref, overlap, onScroll };
}

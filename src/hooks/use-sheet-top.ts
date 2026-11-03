import { useCallback, useRef, useState } from 'react';
import { useWindowDimensions, type View } from 'react-native';

/** Where the slide-up sheets top out, as a share of the screen height (the iPhone profile sheet sits here). */
export const SHEET_TOP = 0.134;

/**
 * Distance from the top of the container to where a sheet should start, so every sheet starts at the same place on
 * the screen however far down its container begins (a dev-build banner, a header, the status bar). Put `ref` and
 * `onLayout` on the container that holds the sheet.
 */
export function useSheetTop() {
  const win = useWindowDimensions();
  const ref = useRef<View>(null);
  const [offsetY, setOffsetY] = useState(0);
  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => setOffsetY(Math.max(0, Math.round(y))));
  }, []);
  return { ref, onLayout, top: Math.max(0, Math.round(win.height * SHEET_TOP) - offsetY) };
}

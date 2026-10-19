import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function closeProfile() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

const PagerContext = createContext<(page: number) => void>(() => {});

/**
 * The arrow that points at the other page (Profile and Settings sit side by side:
 * swipe, or tap the arrow) and the X that closes the sheet. Swiping down also closes it on phones.
 */
export function SheetActions({ to }: { to: 'settings' | 'profile' }) {
  const theme = useTheme();
  const goTo = useContext(PagerContext);
  const toSettings = to === 'settings';
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={() => goTo(toSettings ? 1 : 0)}
        accessibilityRole="button"
        accessibilityLabel={toSettings ? 'Settings, swipe left' : 'Profile, swipe right'}
        hitSlop={8}
        style={({ pressed }) => [
          styles.arrow,
          { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && { opacity: 0.7 },
        ]}>
        {!toSettings && (
          <SymbolView name={Icons.back} size={14} tintColor={theme.accent} />
        )}
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {toSettings ? 'Settings' : 'Profile'}
        </ThemedText>
        {toSettings && (
          <SymbolView name={Icons.chevron} size={14} tintColor={theme.accent} />
        )}
      </Pressable>
      <IconButton icon="close" label="Close" onPress={closeProfile} />
    </View>
  );
}

/** Two pages side by side with dots underneath. Always opens on the first page. */
export function ProfilePager({ pages }: { pages: { key: string; label: string; content: ReactNode }[] }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback(
    (i: number) => {
      ref.current?.scrollTo({ x: i * width, animated: true });
      setIndex(i);
    },
    [width],
  );

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex((prev) => (prev === i ? prev : Math.max(0, Math.min(pages.length - 1, i))));
  }

  return (
    <PagerContext.Provider value={goTo}>
      <View style={styles.fill}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled>
          {pages.map((p) => (
            <View key={p.key} style={{ width }}>
              {p.content}
            </View>
          ))}
        </ScrollView>
        <View pointerEvents="box-none" style={styles.dots}>
          {pages.map((p, i) => (
            <Pressable
              key={p.key}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={p.label}
              hitSlop={10}
              style={styles.dotTouch}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? theme.accent : theme.border },
                  i === index && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </PagerContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  arrow: {
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotTouch: { padding: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 16 },
});

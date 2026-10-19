import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SymbolView } from 'expo-symbols';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ABOUT_FEATURES, ABOUT_SUMMARY, ABOUT_TAGLINE } from '@/content/about';
import { Spacing } from '@/constants/theme';
import { Icons } from '@/constants/icons';
import { useTheme } from '@/hooks/use-theme';

/** Popup that explains what Belay Buddy is, with a link to the full About page. */
export function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={[styles.x, { backgroundColor: theme.backgroundElement }]}>
            <SymbolView name={Icons.close} size={16} tintColor={theme.text} />
          </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
            bounces
            nestedScrollEnabled>
            <ThemedText type="subtitle" accessibilityRole="header">
              About Belay Buddy
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {ABOUT_TAGLINE}
            </ThemedText>
            <ThemedText>{ABOUT_SUMMARY}</ThemedText>
            <View style={styles.list}>
              {ABOUT_FEATURES.map((f) => (
                <ThemedText key={f.title} type="small" themeColor="textSecondary">
                  <ThemedText type="smallBold">{f.title}. </ThemedText>
                  {f.body}
                </ThemedText>
              ))}
            </View>
            <View style={styles.buttons}>
              <Button
                title="Read more"
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push('/about');
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: 520, maxHeight: '65%', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  content: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three },
  header: { alignItems: 'flex-end', paddingTop: Spacing.two, paddingHorizontal: Spacing.two },
  scroll: { flexShrink: 1 },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  list: { gap: Spacing.two },
  buttons: { gap: Spacing.two },
});

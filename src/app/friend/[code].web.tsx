import { Link } from 'expo-router';
import { Pressable } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** A friend link opened in a browser: friends are added in the app. */
export default function FriendLinkWeb() {
  const theme = useTheme();
  return (
    <Screen title="Add a friend" showTitle={false} readable>
      <ThemedText type="subtitle" accessibilityRole="header">Add a friend</ThemedText>
      <ThemedText>Friend links work in the Belay Buddy app. Open this link on your iPhone or Android phone with Belay Buddy installed.</ThemedText>
      <Link href="/manual" asChild>
        <Pressable accessibilityRole="link">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>Read the manual</ThemedText>
        </Pressable>
      </Link>
    </Screen>
  );
}

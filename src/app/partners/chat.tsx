import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icons } from '@/constants/icons';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  displayName,
  fetchCards,
  fetchMessages,
  fetchPost,
  formatWindow,
  sendMessage,
  subscribeToThread,
  threadOpen,
} from '@/lib/partners';
import type { BelayPost, ChatMessage, ClimberCard } from '@/types/models';

/** The short chat between a poster and one climber who said "I'm in". */
export default function ChatScreen() {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const { post: postId, with: responderId } = useLocalSearchParams<{ post: string; with: string }>();

  const [post, setPost] = useState<BelayPost | null | undefined>(undefined);
  const [other, setOther] = useState<ClimberCard | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!user || !postId || !responderId) return;
    let active = true;
    const add = (m: ChatMessage) =>
      setMessages((current) => (current?.some((x) => x.id === m.id) ? current : [...(current ?? []), m]));

    (async () => {
      try {
        const [p, ms] = await Promise.all([fetchPost(postId), fetchMessages(postId, responderId)]);
        if (!active) return;
        setPost(p);
        setMessages(ms);
        // The other person: the poster if I responded, otherwise the responder.
        const otherId = responderId === user.id ? p?.userId : responderId;
        if (otherId) {
          const cards = await fetchCards([otherId]);
          if (active) setOther(cards.get(otherId));
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();

    const unsubscribe = subscribeToThread(postId, responderId, add);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, postId, responderId]);

  if (!user) return null;

  // An ended session's post is no longer readable; the chat stays readable
  // for a day but can't take new messages.
  const open = post ? threadOpen(post) : false;
  const otherName = displayName(other);

  async function send() {
    const body = draft.trim();
    if (!body || !postId || !responderId) return;
    setSending(true);
    setError(null);
    try {
      const m = await sendMessage(postId, responderId, body);
      setMessages((current) => (current?.some((x) => x.id === m.id) ? current : [...(current ?? []), m]));
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <PageTitle title={`Chat with ${otherName}`} />
      <Stack.Screen options={{ title: otherName }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {post && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {post.areaName} · {formatWindow(post)}
            </ThemedText>
          )}
          {messages === null && !error ? (
            <ActivityIndicator />
          ) : messages?.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Say hi and sort out where to meet, like the front desk or the top-rope area.
            </ThemedText>
          ) : (
            messages?.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.bubble,
                    mine
                      ? [styles.mine, { backgroundColor: theme.accent }]
                      : [styles.theirs, { backgroundColor: theme.backgroundElement }],
                  ]}>
                  <ThemedText style={mine ? { color: theme.onAccent } : undefined}>{m.body}</ThemedText>
                </View>
              );
            })
          )}
          {error && (
            <ThemedText type="small" style={[styles.center, { color: theme.accent }]}>
              {error}
            </ThemedText>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { borderTopColor: theme.backgroundElement }]}>
          {open ? (
            <>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Message ${otherName}`}
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={1000}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              />
              <Pressable
                onPress={send}
                disabled={sending || !draft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={({ pressed }) => [(pressed || sending || !draft.trim()) && styles.dim]}>
                <SymbolView name={Icons.send} size={32} tintColor={theme.accent} />
              </Pressable>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {post === undefined ? ' ' : 'This session has ended, so the chat is closed.'}
            </ThemedText>
          )}
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  center: { textAlign: 'center', flex: 1 },
  bubble: { maxWidth: '80%', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two + (Platform.OS === 'ios' ? BottomTabInset : 0),
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    fontSize: 16,
  },
  dim: { opacity: 0.5 },
});

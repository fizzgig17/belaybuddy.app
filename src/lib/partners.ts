import { supabase } from '@/lib/supabase';
import type {
  BelayCert,
  BelayPost,
  ChatMessage,
  ClimberCard,
  ClimbingStyle,
  SessionGoal,
  WeightHint,
} from '@/types/models';

// Access rules live in the database (supabase/migrations/*_partners.sql);
// these helpers only shape rows. Anything RLS hides simply doesn't come back.

export const GOAL_LABELS: Record<SessionGoal, string> = {
  projecting: 'Projecting',
  mileage: 'Mileage',
  'learning-lead': 'Learning to lead',
  'top-rope-laps': 'Top-rope laps',
  bouldering: 'Bouldering',
};

export const POST_STYLE_LABELS: Record<BelayPost['styles'][number], string> = {
  'top-rope': 'Top rope',
  lead: 'Lead',
  bouldering: 'Bouldering',
};

export const WEIGHT_HINT_TEXT: Record<WeightHint, string> = {
  similar: 'Good weight match for lead.',
  'some-difference':
    'Some weight difference. On lead, the lighter partner may get lifted on falls; talk it through first.',
  'large-difference':
    'Big weight difference. For lead, consider an Ohm or a ground anchor when the lighter partner belays.',
};

// --- Posts ---------------------------------------------------------------------

type PostRow = {
  id: string;
  user_id: string;
  area_id: string;
  area_name: string;
  starts_at: string;
  ends_at: string;
  here_now: boolean;
  goal: SessionGoal;
  styles: BelayPost['styles'];
  grade_low: string | null;
  grade_high: string | null;
  mentoring: boolean;
  note: string | null;
};

const POST_COLUMNS =
  'id, user_id, area_id, area_name, starts_at, ends_at, here_now, goal, styles, grade_low, grade_high, mentoring, note';

const postFromRow = (r: PostRow): BelayPost => ({
  id: r.id,
  userId: r.user_id,
  areaId: r.area_id,
  areaName: r.area_name,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  hereNow: r.here_now,
  goal: r.goal,
  styles: r.styles,
  gradeLow: r.grade_low ?? undefined,
  gradeHigh: r.grade_high ?? undefined,
  mentoring: r.mentoring,
  note: r.note ?? undefined,
});

/** Live posts on one gym's board, soonest first. */
export async function fetchBoard(areaId: string): Promise<BelayPost[]> {
  const { data, error } = await supabase
    .from('belay_posts')
    .select(POST_COLUMNS)
    .eq('area_id', areaId)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .limit(100);
  if (error) throw error;
  return (data as PostRow[]).map(postFromRow);
}

export async function fetchPost(id: string): Promise<BelayPost | null> {
  const { data, error } = await supabase.from('belay_posts').select(POST_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? postFromRow(data as PostRow) : null;
}

export async function fetchMyPosts(userId: string): Promise<BelayPost[]> {
  const { data, error } = await supabase
    .from('belay_posts')
    .select(POST_COLUMNS)
    .eq('user_id', userId)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data as PostRow[]).map(postFromRow);
}

export type NewPost = Omit<BelayPost, 'id' | 'userId'>;

export async function createPost(post: NewPost): Promise<BelayPost> {
  const blank = (s?: string) => (s?.trim() ? s.trim() : null);
  const { data, error } = await supabase
    .from('belay_posts')
    .insert({
      area_id: post.areaId,
      area_name: post.areaName,
      starts_at: post.startsAt,
      ends_at: post.endsAt,
      here_now: post.hereNow,
      goal: post.goal,
      styles: post.styles,
      grade_low: blank(post.gradeLow),
      grade_high: blank(post.gradeHigh),
      mentoring: post.mentoring,
      note: blank(post.note),
    })
    .select(POST_COLUMNS)
    .single();
  if (error) throw error;
  return postFromRow(data as PostRow);
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('belay_posts').delete().eq('id', id);
  if (error) throw error;
}

// --- "I'm in" ------------------------------------------------------------------

/** Who has said "I'm in" (the poster sees everyone; others see only themselves). */
export async function fetchResponders(postIds: string[]): Promise<{ postId: string; userId: string }[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from('post_responses')
    .select('post_id, user_id')
    .in('post_id', postIds)
    .order('created_at');
  if (error) throw error;
  return (data as { post_id: string; user_id: string }[]).map((r) => ({ postId: r.post_id, userId: r.user_id }));
}

/** Live posts the user has joined. */
export async function fetchJoinedPosts(userId: string): Promise<BelayPost[]> {
  const { data, error } = await supabase
    .from('post_responses')
    .select(`belay_posts (${POST_COLUMNS})`)
    .eq('user_id', userId);
  if (error) throw error;
  // Expired or blocked posts come back as null through the embed.
  return (data as unknown as { belay_posts: PostRow | null }[])
    .map((r) => r.belay_posts)
    .filter((p): p is PostRow => !!p)
    .map(postFromRow)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function joinPost(postId: string) {
  const { error } = await supabase.from('post_responses').insert({ post_id: postId });
  if (error) throw error;
}

export async function leavePost(postId: string, userId: string) {
  const { error } = await supabase.from('post_responses').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

// --- Climber cards -------------------------------------------------------------

type CardRow = {
  id: string;
  display_name: string | null;
  bio: string | null;
  home_area: string | null;
  styles: string[];
  boulder_grade: string | null;
  route_grade: string | null;
  years_climbing: number | null;
  belay_certified: string[];
  assisted_braking: boolean;
  member_since: string;
  weight_hint: WeightHint | null;
};

/** Public cards by user id. Blocked people (either way) are left out. */
export async function fetchCards(userIds: string[]): Promise<Map<string, ClimberCard>> {
  const ids = [...new Set(userIds)];
  const cards = new Map<string, ClimberCard>();
  if (ids.length === 0) return cards;
  const { data, error } = await supabase.rpc('climber_cards', { ids });
  if (error) throw error;
  for (const r of data as CardRow[]) {
    cards.set(r.id, {
      userId: r.id,
      displayName: r.display_name ?? undefined,
      bio: r.bio ?? undefined,
      homeArea: r.home_area ?? undefined,
      styles: r.styles as ClimbingStyle[],
      boulderGrade: r.boulder_grade ?? undefined,
      routeGrade: r.route_grade ?? undefined,
      yearsClimbing: r.years_climbing ?? undefined,
      belayCertified: r.belay_certified as BelayCert[],
      assistedBraking: r.assisted_braking,
      memberSince: r.member_since,
      weightHint: r.weight_hint ?? undefined,
    });
  }
  return cards;
}

export const displayName = (card?: ClimberCard) => card?.displayName || 'A climber';

/** New accounts are labeled as new (principle 1). */
export function isNewMember(card: ClimberCard): boolean {
  return Date.now() - new Date(card.memberSince).getTime() < 30 * 24 * 3600_000;
}

// --- Chat ----------------------------------------------------------------------

type MessageRow = {
  id: number;
  post_id: string;
  responder_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const messageFromRow = (r: MessageRow): ChatMessage => ({
  id: r.id,
  postId: r.post_id,
  responderId: r.responder_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
});

export async function fetchMessages(postId: string, responderId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, post_id, responder_id, sender_id, body, created_at')
    .eq('post_id', postId)
    .eq('responder_id', responderId)
    .order('created_at')
    .limit(500);
  if (error) throw error;
  return (data as MessageRow[]).map(messageFromRow);
}

export async function sendMessage(postId: string, responderId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ post_id: postId, responder_id: responderId, body: body.trim() })
    .select('id, post_id, responder_id, sender_id, body, created_at')
    .single();
  if (error) throw error;
  return messageFromRow(data as MessageRow);
}

/** Calls onMessage for each new message in the thread. Returns an unsubscribe. */
export function subscribeToThread(
  postId: string,
  responderId: string,
  onMessage: (message: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(`thread:${postId}:${responderId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `post_id=eq.${postId}` },
      (payload) => {
        const row = payload.new as MessageRow;
        if (row.responder_id === responderId) onMessage(messageFromRow(row));
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Threads stay open for 2 hours after the session (matches the database). */
export const threadOpen = (post: BelayPost) => new Date(post.endsAt).getTime() + 2 * 3600_000 > Date.now();

// --- Safety --------------------------------------------------------------------

export type BlockedClimber = { userId: string; name?: string };

export async function fetchBlocked(): Promise<BlockedClimber[]> {
  const { data, error } = await supabase.from('blocks').select('blocked, blocked_name').order('created_at');
  if (error) throw error;
  return (data as { blocked: string; blocked_name: string | null }[]).map((r) => ({
    userId: r.blocked,
    name: r.blocked_name ?? undefined,
  }));
}

export async function blockClimber(userId: string, name?: string) {
  const { error } = await supabase.from('blocks').insert({ blocked: userId, blocked_name: name?.slice(0, 50) ?? null });
  // Already blocked is fine.
  if (error && error.code !== '23505') throw error;
}

export async function unblockClimber(userId: string) {
  const { error } = await supabase.from('blocks').delete().eq('blocked', userId);
  if (error) throw error;
}

export type ReportReason = 'unsafe-belay' | 'harassment' | 'no-show' | 'fake' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'unsafe-belay', label: 'Unsafe belaying' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'no-show', label: 'Repeated no-shows' },
  { value: 'fake', label: 'Fake profile' },
  { value: 'other', label: 'Something else' },
];

export async function reportClimber(userId: string, reason: ReportReason, details: string, postId?: string) {
  const { error } = await supabase.from('reports').insert({
    reported: userId,
    reason,
    details: details.trim() || null,
    post_id: postId ?? null,
  });
  if (error) throw error;
}

export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

// --- Formatting ----------------------------------------------------------------

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Here now until 8:00 PM", "Today 6:00 PM – 8:00 PM", "Sat, Oct 24 10:00 AM – 1:00 PM". */
export function formatWindow(post: Pick<BelayPost, 'startsAt' | 'endsAt' | 'hereNow'>): string {
  const start = new Date(post.startsAt);
  const end = new Date(post.endsAt);
  if (post.hereNow && start.getTime() <= Date.now()) return `Here now until ${time(end)}`;
  return `${dayLabel(start)} ${time(start)} – ${time(end)}`;
}

export function formatGrades(post: Pick<BelayPost, 'gradeLow' | 'gradeHigh'>): string | undefined {
  if (post.gradeLow && post.gradeHigh) return `${post.gradeLow}–${post.gradeHigh}`;
  return post.gradeLow ?? post.gradeHigh;
}

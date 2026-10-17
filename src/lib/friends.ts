// Friends and gym check-ins. The rules live in the database (migration
// *_friends.sql); these are thin wrappers. See docs/product-principles.md: a
// check-in is opt-in, lasts a few hours, and only friends see it.
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type Friend = {
  friendshipId: string;
  userId: string;
  name: string;
  /** 'friend', a request they sent you ('incoming') or one you sent ('outgoing'). */
  direction: 'friend' | 'incoming' | 'outgoing';
  since: string;
  /** Where they are checked in right now, if they are. */
  checkIn?: { areaId: string; areaName: string; until: string };
};

type OverviewRow = {
  friendship_id: string;
  other_id: string;
  display_name: string;
  direction: Friend['direction'];
  since: string;
  area_id: string | null;
  area_name: string | null;
  checked_in_until: string | null;
};

export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('friends_overview');
  if (error) throw new Error(error.message);
  return ((data ?? []) as OverviewRow[]).map((r) => ({
    friendshipId: r.friendship_id,
    userId: r.other_id,
    name: r.display_name,
    direction: r.direction,
    since: r.since,
    checkIn:
      r.area_id && r.area_name && r.checked_in_until
        ? { areaId: r.area_id, areaName: r.area_name, until: r.checked_in_until }
        : undefined,
  }));
}

/** Friends, requests and who is where, kept current; call `refresh` after changes. */
export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setFriends([]);
      return;
    }
    setLoading(true);
    try {
      setFriends(await fetchFriends());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    friends: friends.filter((f) => f.direction === 'friend'),
    incoming: friends.filter((f) => f.direction === 'incoming'),
    outgoing: friends.filter((f) => f.direction === 'outgoing'),
    loading,
    error,
    refresh,
  };
}

export async function myFriendCode(): Promise<string> {
  const { data, error } = await supabase.rpc('my_friend_code');
  if (error) throw new Error(error.message);
  return data as string;
}

export const friendLink = (code: string) => `https://belaybuddy.app/friend/${code}`;

export type AddResult = { status: 'requested' | 'accepted' | 'already' | 'invalid'; name: string };

export async function addFriendByCode(code: string): Promise<AddResult> {
  const { data, error } = await supabase.rpc('add_friend_by_code', { p_code: code });
  if (error) throw new Error(error.message);
  const out = data as { status: AddResult['status']; name?: string };
  return { status: out.status, name: out.name ?? 'Climber' };
}

export type Climber = { id: string; name: string; sharedGym: string };

export async function findClimbers(query: string): Promise<Climber[]> {
  const { data, error } = await supabase.rpc('find_climbers', { p_query: query });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; display_name: string; shared_gym: string }[]).map((r) => ({
    id: r.id,
    name: r.display_name,
    sharedGym: r.shared_gym,
  }));
}

export async function requestFriend(userId: string): Promise<AddResult['status']> {
  const { data, error } = await supabase.rpc('request_friend', { p_user: userId });
  if (error) throw new Error(error.message);
  return data as AddResult['status'];
}

export async function respondToRequest(friendshipId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_friend_request', { p_id: friendshipId, p_accept: accept });
  if (error) throw new Error(error.message);
}

/** Unfriend, decline or cancel: either person may remove the row. */
export async function removeFriendship(friendshipId: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error(error.message);
}

// --- Check-ins ----------------------------------------------------------------

export type CheckIn = { areaId: string; areaName: string; until: string };

export async function fetchMyCheckIn(): Promise<CheckIn | null> {
  const { data, error } = await supabase
    .from('checkins')
    .select('area_id, area_name, expires_at')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { areaId: data.area_id, areaName: data.area_name, until: data.expires_at } : null;
}

export async function checkIn(areaId: string, areaName: string, hours = 4): Promise<CheckIn> {
  const { data, error } = await supabase.rpc('check_in', { p_area_id: areaId, p_area_name: areaName, p_hours: hours });
  if (error) throw new Error(error.message);
  return { areaId, areaName, until: data as string };
}

export async function checkOut(userId: string) {
  const { error } = await supabase.from('checkins').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export const formatUntil = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// --- A friend code that arrived in a link before the person was signed in -----------

const PENDING_KEY = 'bb.pendingFriendCode';

export function savePendingCode(code: string) {
  try {
    globalThis.localStorage?.setItem(PENDING_KEY, code);
  } catch {
    // Convenience only.
  }
}

export function takePendingCode(): string | null {
  try {
    const code = globalThis.localStorage?.getItem(PENDING_KEY) ?? null;
    if (code) globalThis.localStorage?.removeItem(PENDING_KEY);
    return code;
  } catch {
    return null;
  }
}

// --- "Find me by name" ----------------------------------------------------------

export async function fetchDiscoverable(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('discoverable').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.discoverable ?? true;
}

export async function saveDiscoverable(userId: string, on: boolean) {
  const { error } = await supabase.from('profiles').update({ discoverable: on }).eq('id', userId);
  if (error) throw new Error(error.message);
}

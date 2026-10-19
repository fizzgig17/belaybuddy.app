import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type PendingEdit = {
  id: number;
  placeId: string;
  placeName: string;
  kind: 'gym' | 'shop';
  value: string;
  currentValue: string | null;
  submittedBy: string;
  createdAt: string;
};

export type AdminPerson = { userId: string; displayName: string; isMe: boolean };

/** null while checking, then true/false. The database enforces it; this only shows the menu. */
let cached: { userId: string; admin: boolean } | null = null;

export function useIsAdmin(): boolean | null {
  const { user } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(cached && cached.userId === user?.id ? cached.admin : null);
  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    let active = true;
    const check = (retries: number) =>
      supabase.rpc('is_admin').then(({ data, error }) => {
        if (!active) return;
        if (error && retries > 0) return setTimeout(() => check(retries - 1), 1500);
        const yes = !error && data === true;
        cached = { userId: user.id, admin: yes };
        setAdmin(yes);
      });
    check(2);
    return () => {
      active = false;
    };
  }, [user]);
  return admin;
}

const fail = (e: { message: string }): never => {
  throw new Error(/Not allowed/i.test(e.message) ? 'Only admins can do that.' : e.message);
};

export async function fetchPendingEdits(): Promise<PendingEdit[]> {
  const { data, error } = await supabase.rpc('admin_pending_edits');
  if (error) fail(error);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: r.id,
    placeId: r.place_id,
    placeName: r.place_name ?? 'Unnamed place',
    kind: r.kind,
    value: r.value,
    currentValue: r.current_value,
    submittedBy: r.submitted_by,
    createdAt: r.created_at,
  }));
}

export async function reviewEdit(id: number, approve: boolean) {
  const { error } = await supabase.rpc('admin_review_edit', { p_id: id, p_approve: approve });
  if (error) fail(error);
}

export async function fetchAdmins(): Promise<AdminPerson[]> {
  const { data, error } = await supabase.rpc('admin_list_admins');
  if (error) fail(error);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    isMe: r.is_me,
  }));
}

/** Returns the new admin's name, or null if no one has that friend code. */
export async function addAdminByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_add_admin', { p_code: code });
  if (error) fail(error);
  return (data as string | null) ?? null;
}

/** Returns the new admin's name, or null if no account uses that email. */
export async function addAdminByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_add_admin_by_email', { p_email: email });
  if (error) fail(error);
  return (data as string | null) ?? null;
}

export async function removeAdmin(userId: string) {
  const { error } = await supabase.rpc('admin_remove_admin', { p_user: userId });
  if (error) fail(/at least one admin/i.test(error.message) ? { message: 'There must be at least one admin.' } : error);
}

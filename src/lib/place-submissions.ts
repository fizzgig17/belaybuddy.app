import { supabase } from '@/lib/supabase';
import type { LatLng } from '@/types/models';

export type SubmissionKind = 'gym' | 'crag' | 'shop';

export type SubmissionInput = {
  kind: SubmissionKind;
  name: string;
  address?: string;
  point?: LatLng;
  website?: string;
  phone?: string;
  hoursText?: string;
  notes?: string;
  searchedFor?: string;
};

/** The place we already have that looks like what was sent, if the database found one close by. */
export type PossibleMatch = { name: string; distanceKm: number | null };

const clean = (v: string | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Sends a missing gym, crag or shop for review. The database checks it against the catalog as it
 * arrives, so this can say straight away when we probably already have it.
 * Throws an Error with a message safe to show.
 */
export async function submitPlace(input: SubmissionInput): Promise<{ possibleMatch: PossibleMatch | null }> {
  const { data, error } = await supabase
    .from('place_submissions')
    .insert({
      kind: input.kind,
      name: input.name.trim(),
      address: clean(input.address),
      latitude: input.point?.latitude ?? null,
      longitude: input.point?.longitude ?? null,
      website: clean(input.website),
      phone: clean(input.phone),
      hours_text: clean(input.hoursText),
      notes: clean(input.notes),
      searched_for: clean(input.searchedFor),
    })
    .select('findings')
    .single();
  if (error) {
    throw new Error(
      /Too many submissions/i.test(error.message) ? 'Too many submissions today. Try again tomorrow.' : 'Could not send that. Please try again.',
    );
  }
  const f = data?.findings as { verdict?: string; name_matches?: { name: string; distance_km: number | null }[] } | null;
  const top = f?.verdict === 'probably_exists' ? f.name_matches?.[0] : undefined;
  return { possibleMatch: top ? { name: top.name, distanceKm: top.distance_km } : null };
}

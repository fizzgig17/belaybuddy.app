import { supabase } from '@/lib/supabase';
import type { BelayCert, ClimberProfile, ClimbingStyle } from '@/types/models';

/** Row shape of public.profiles (see supabase/migrations). */
type ProfileRow = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  home_area: string | null;
  styles: string[];
  boulder_grade: string | null;
  route_grade: string | null;
  years_climbing: number | null;
  has_gear: ClimberProfile['hasGear'];
  belay_certified: string[];
};

const COLUMNS =
  'id, display_name, bio, avatar_url, home_area, styles, boulder_grade, route_grade, years_climbing, has_gear, belay_certified';

const EMPTY_GEAR: ClimberProfile['hasGear'] = { rope: false, quickdraws: false, rack: false, crashPad: false };

function fromRow(row: ProfileRow): ClimberProfile {
  return {
    userId: row.id,
    displayName: row.display_name ?? undefined,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    homeArea: row.home_area ?? undefined,
    styles: row.styles as ClimbingStyle[],
    boulderGrade: row.boulder_grade ?? undefined,
    routeGrade: row.route_grade ?? undefined,
    yearsClimbing: row.years_climbing ?? undefined,
    hasGear: { ...EMPTY_GEAR, ...row.has_gear },
    belayCertified: row.belay_certified as BelayCert[],
  };
}

/** Blank strings are stored as null so "cleared" fields stay empty. */
function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function fetchMyProfile(userId: string): Promise<ClimberProfile> {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).single();
  if (error) throw error;
  return fromRow(data as ProfileRow);
}

export type ProfileUpdate = Omit<ClimberProfile, 'userId' | 'avatarUrl'>;

export async function updateMyProfile(userId: string, update: ProfileUpdate): Promise<ClimberProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: clean(update.displayName),
      bio: clean(update.bio),
      home_area: clean(update.homeArea),
      styles: update.styles,
      boulder_grade: clean(update.boulderGrade),
      route_grade: clean(update.routeGrade),
      years_climbing: update.yearsClimbing ?? null,
      has_gear: update.hasGear,
      belay_certified: update.belayCertified,
    })
    .eq('id', userId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as ProfileRow);
}

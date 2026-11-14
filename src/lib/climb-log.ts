import { supabase } from '@/lib/supabase';

// Private to the climber: row-level security (migrations/*_climb_log.sql) hides everyone else's.

export type Discipline = 'boulder' | 'route';
export type Result = 'send' | 'flash' | 'attempt';

export const BOULDER_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
export const ROUTE_GRADES = [
  '5.5', '5.6', '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b', '5.12c', '5.12d',
  '5.13a', '5.13b', '5.13c', '5.13d',
];
export const gradesFor = (d: Discipline) => (d === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES);

/** Hold colors a route can be taped with, in the order shown. Hex values are for the swatches only. */
export const ROUTE_COLORS: { key: string; label: string; hex: string }[] = [
  { key: 'red', label: 'Red', hex: '#D64545' },
  { key: 'orange', label: 'Orange', hex: '#EE8A2B' },
  { key: 'yellow', label: 'Yellow', hex: '#F2C230' },
  { key: 'green', label: 'Green', hex: '#3F9A5B' },
  { key: 'teal', label: 'Teal', hex: '#20A6A6' },
  { key: 'blue', label: 'Blue', hex: '#2F7FD1' },
  { key: 'purple', label: 'Purple', hex: '#7A5BC4' },
  { key: 'pink', label: 'Pink', hex: '#E87AAE' },
  { key: 'white', label: 'White', hex: '#F4F4F0' },
  { key: 'black', label: 'Black', hex: '#25282B' },
  { key: 'gray', label: 'Gray', hex: '#8A9094' },
  { key: 'brown', label: 'Brown', hex: '#8B5E3C' },
];

/** A color that is not on the list is stored as "#RRGGBB". */
export const isHexColor = (v: string | null | undefined): v is `#${string}` => !!v && /^#[0-9a-fA-F]{6}$/.test(v);
export const colorHex = (key: string | null | undefined) =>
  isHexColor(key) ? key.toUpperCase() : (ROUTE_COLORS.find((c) => c.key === key)?.hex ?? null);
/** "Teal" for a listed color, "Custom" for one picked by hand. */
export const colorLabel = (key: string | null | undefined) =>
  isHexColor(key) ? 'Custom' : (ROUTE_COLORS.find((c) => c.key === key)?.label ?? null);

function toLab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/**
 * The listed color that looks most like this hex color: nearest in CIELAB, counting lightness at a third of the weight so a
 * pale pink goes to pink rather than white and a tan goes to brown.
 */
export function nearestRouteColor(hex: string): string {
  if (!isHexColor(hex)) return '';
  const [l, a, b] = toLab(hex);
  let best = ROUTE_COLORS[0].key;
  let bestD = Infinity;
  for (const c of ROUTE_COLORS) {
    const [l2, a2, b2] = toLab(c.hex);
    const d = (0.3 * (l - l2)) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.key;
    }
  }
  return best;
}

export const RESULT_LABELS: Record<Result, string> = { send: 'Sent', flash: 'Flash', attempt: 'Attempt' };

export type ClimbLog = {
  id: string;
  sessionId: string;
  discipline: Discipline;
  grade: string;
  result: Result;
  loggedAt: string;
  /** Hold color of the route: one of ROUTE_COLORS, or a custom "#RRGGBB", if recorded. */
  color: string | null;
  routeName: string | null;
  /** Height of the wall or boulder in feet, if recorded. */
  wallHeight: number | null;
};

export type ClimbSession = {
  id: string;
  areaId: string | null;
  areaName: string | null;
  startedAt: string;
  endedAt: string | null;
  logs: ClimbLog[];
};

type LogRow = {
  id: string;
  session_id: string;
  discipline: Discipline;
  grade: string;
  result: Result;
  logged_at: string;
  color: string | null;
  route_name: string | null;
  wall_height: number | null;
};
type SessionRow = {
  id: string;
  area_id: string | null;
  area_name: string | null;
  started_at: string;
  ended_at: string | null;
  climb_logs?: LogRow[];
};

const LOG_COLUMNS = 'id, session_id, discipline, grade, result, logged_at, color, route_name, wall_height';
const SELECT = `id, area_id, area_name, started_at, ended_at, climb_logs(${LOG_COLUMNS})`;

const logFromRow = (r: LogRow): ClimbLog => ({
  id: r.id,
  sessionId: r.session_id,
  discipline: r.discipline,
  grade: r.grade,
  result: r.result,
  loggedAt: r.logged_at,
  color: r.color ?? null,
  routeName: r.route_name ?? null,
  wallHeight: r.wall_height ?? null,
});

const sessionFromRow = (r: SessionRow): ClimbSession => ({
  id: r.id,
  areaId: r.area_id,
  areaName: r.area_name,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  logs: (r.climb_logs ?? []).map(logFromRow).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
});

export async function fetchActiveSession(): Promise<ClimbSession | null> {
  const { data, error } = await supabase.from('climb_sessions').select(SELECT).is('ended_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sessionFromRow(data as SessionRow) : null;
}

export async function fetchSessions(limit = 50): Promise<ClimbSession[]> {
  const { data, error } = await supabase
    .from('climb_sessions')
    .select(SELECT)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SessionRow[]).map(sessionFromRow);
}

export async function startSession(area: { areaId: string; areaName: string } | null): Promise<ClimbSession> {
  const { data, error } = await supabase
    .from('climb_sessions')
    .insert({ area_id: area?.areaId ?? null, area_name: area?.areaName ?? null })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return sessionFromRow(data as SessionRow);
}

export async function endSession(id: string): Promise<void> {
  const { error } = await supabase.from('climb_sessions').update({ ended_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function logClimb(
  sessionId: string,
  discipline: Discipline,
  grade: string,
  result: Result,
  extra: { color?: string | null; routeName?: string | null; wallHeight?: number | null } = {},
): Promise<ClimbLog> {
  const { data, error } = await supabase
    .from('climb_logs')
    .insert({
      session_id: sessionId,
      discipline,
      grade,
      result,
      color: extra.color || null,
      route_name: extra.routeName?.trim() || null,
      wall_height: cleanWallHeight(extra.wallHeight),
    })
    .select(LOG_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return logFromRow(data as LogRow);
}

/** The fields of a logged climb a person can change afterwards. */
export type ClimbEdit = {
  discipline: Discipline;
  grade: string;
  result: Result;
  color: string | null;
  routeName: string | null;
  wallHeight: number | null;
};

/** A wall height in whole feet between 1 and 500, or null. */
export function cleanWallHeight(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 500 ? n : null;
}

export async function updateClimb(id: string, edit: ClimbEdit): Promise<ClimbLog> {
  const { data, error } = await supabase
    .from('climb_logs')
    .update({
      discipline: edit.discipline,
      grade: edit.grade,
      result: edit.result,
      color: edit.color || null,
      route_name: edit.routeName?.trim() || null,
      wall_height: cleanWallHeight(edit.wallHeight),
    })
    .eq('id', id)
    .select(LOG_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return logFromRow(data as LogRow);
}

export async function deleteClimb(id: string): Promise<void> {
  const { error } = await supabase.from('climb_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('climb_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Summaries ---------------------------------------------------------------

export type Summary = {
  climbs: number;
  sends: number;
  flashes: number;
  attempts: number;
  hardestBoulder: string | null;
  hardestRoute: string | null;
};

/** Gyms often grade 5.10- / 5.10+ or V4-; a modifier sorts just below / above its base grade. */
export type GradeMod = '' | '-' | '+';
const MOD_ORDER: Record<GradeMod, number> = { '-': 0, '': 1, '+': 2 };

const rank = (d: Discipline, grade: string) => {
  const mod = (/[+-]$/.exec(grade)?.[0] ?? '') as GradeMod;
  const i = gradesFor(d).indexOf(mod ? grade.slice(0, -1) : grade);
  return i < 0 ? -1 : i * 3 + MOD_ORDER[mod];
};

export function summarize(logs: ClimbLog[]): Summary {
  const s: Summary = { climbs: logs.length, sends: 0, flashes: 0, attempts: 0, hardestBoulder: null, hardestRoute: null };
  for (const l of logs) {
    if (l.result === 'attempt') {
      s.attempts++;
      continue;
    }
    if (l.result === 'flash') s.flashes++;
    else s.sends++;
    if (l.discipline === 'boulder') {
      if (!s.hardestBoulder || rank('boulder', l.grade) > rank('boulder', s.hardestBoulder)) s.hardestBoulder = l.grade;
    } else if (!s.hardestRoute || rank('route', l.grade) > rank('route', s.hardestRoute)) s.hardestRoute = l.grade;
  }
  return s;
}

/** "5 sends (1 flash), 3 attempts" style one-liner. */
export function describeSummary(s: Summary): string {
  if (s.climbs === 0) return 'No climbs logged';
  const done = s.sends + s.flashes;
  const parts = [`${done} ${done === 1 ? 'send' : 'sends'}`];
  if (s.flashes) parts[0] += ` (${s.flashes} flash${s.flashes === 1 ? '' : 'es'})`;
  if (s.attempts) parts.push(`${s.attempts} ${s.attempts === 1 ? 'attempt' : 'attempts'}`);
  return parts.join(', ');
}

export function hardest(s: Summary): string | null {
  const parts = [s.hardestBoulder, s.hardestRoute].filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

export function formatDuration(startIso: string, endIso: string | null, now = Date.now()): string {
  const minutes = Math.max(0, Math.round(((endIso ? Date.parse(endIso) : now) - Date.parse(startIso)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

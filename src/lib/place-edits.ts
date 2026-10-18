import { supabase } from '@/lib/supabase';

/** Opening hours as the form collects them: one entry per day, Monday first. */
export type DayHours = { closed: boolean; open: string; close: string };

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** "6", "6am", "6:30 pm", "18:00" -> "06:00" style, or null if it isn't a time. */
export function parseTime(input: string): string | null {
  const m = /^\s*(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?m?\.?\s*$/i.exec(input);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59) return null;
  const ap = m[3]?.toLowerCase();
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
  } else if (h > 24 || (h === 24 && min > 0)) {
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function dayList(indexes: number[]): string {
  // Three or more days in a row read as a range ("Mo-Fr").
  const out: string[] = [];
  for (let i = 0; i < indexes.length; ) {
    let j = i;
    while (j + 1 < indexes.length && indexes[j + 1] === indexes[j] + 1) j++;
    if (j - i >= 2) out.push(`${OSM_DAYS[indexes[i]]}-${OSM_DAYS[indexes[j]]}`);
    else for (let k = i; k <= j; k++) out.push(OSM_DAYS[indexes[k]]);
    i = j + 1;
  }
  return out.join(',');
}

/**
 * Turns the form into OpenStreetMap opening_hours text, like
 * "Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00; We off". Returns an error message instead if a day is incomplete.
 */
export function hoursToOsm(days: DayHours[]): { value: string } | { error: string } {
  const spec: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = days[i];
    if (d.closed) {
      spec.push('off');
      continue;
    }
    const open = parseTime(d.open);
    let close = parseTime(d.close);
    // "9" to "5" means 9am to 5pm: a closing time without am/pm that would land before opening is the evening.
    if (open && close && !/[ap]/i.test(d.close) && !d.close.includes(':') && close <= open) {
      const h = Number(close.slice(0, 2));
      if (h >= 1 && h <= 11) close = `${String(h + 12).padStart(2, '0')}${close.slice(2)}`;
    }
    if (!open || !close) return { error: `Enter an opening and closing time for ${DAY_NAMES[i]}, like 9am and 9:30pm, or mark it closed.` };
    if (open === close) return { error: `${DAY_NAMES[i]} opens and closes at the same time.` };
    spec.push(`${open}-${close}`);
  }
  if (spec.every((s) => s === 'off')) return { error: 'Mark at least one day as open.' };
  const groups: { spec: string; days: number[] }[] = [];
  spec.forEach((s, i) => {
    const g = groups.find((x) => x.spec === s);
    if (g) g.days.push(i);
    else groups.push({ spec: s, days: [i] });
  });
  const value = groups.map((g) => `${dayList(g.days)} ${g.spec}`).join('; ');
  return { value };
}

/** Sends a hours suggestion for review. Throws an Error with a message safe to show. */
export async function suggestHours(place: { id: string; name: string; kind: 'gym' | 'shop' }, value: string) {
  const { error } = await supabase.from('place_edits').insert({
    place_id: place.id,
    place_name: place.name,
    kind: place.kind,
    field: 'opening_hours',
    value,
  });
  if (error) {
    throw new Error(/Too many suggestions/i.test(error.message) ? 'Too many suggestions today. Try again tomorrow.' : 'Could not send that. Please try again.');
  }
}

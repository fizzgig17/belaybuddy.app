/**
 * Turns OpenStreetMap opening_hours into readable lines.
 * Handles the common forms ("Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00", "24/7",
 * "Mo off"). Anything unusual is shown as written rather than guessed at.
 */
const DAYS: Record<string, string> = {
  Mo: 'Mon',
  Tu: 'Tue',
  We: 'Wed',
  Th: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  Su: 'Sun',
  PH: 'Holidays',
};

function time12(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = Number(m[1]);
  const min = m[2];
  if (h === 24) h = 0;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === '00' ? `${h12} ${suffix}` : `${h12}:${min} ${suffix}`;
}

function days(spec: string): string | null {
  const parts = spec.split(',').map((p) => p.trim());
  const out: string[] = [];
  for (const part of parts) {
    const range = /^([A-Z][a-z])-([A-Z][a-z])$/.exec(part);
    if (range && DAYS[range[1]] && DAYS[range[2]]) out.push(`${DAYS[range[1]]}–${DAYS[range[2]]}`);
    else if (DAYS[part]) out.push(DAYS[part]);
    else return null;
  }
  return out.join(', ');
}

function times(spec: string): string | null {
  const s = spec.trim();
  if (/^(off|closed)$/i.test(s)) return 'Closed';
  const ranges = s.split(',').map((r) => r.trim());
  const out: string[] = [];
  for (const r of ranges) {
    const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/.exec(r);
    if (!m) return null;
    out.push(`${time12(m[1])} – ${time12(m[2])}`);
  }
  return out.join(', ');
}

export type HoursLine = { days: string; hours: string };

/** Readable lines, or null if the value can't be parsed confidently. */
export function formatOpeningHours(raw: string): HoursLine[] | null {
  const value = raw.trim();
  if (value === '24/7') return [{ days: 'Every day', hours: 'Open 24 hours' }];
  const lines: HoursLine[] = [];
  for (const rule of value.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = /^([A-Za-z][A-Za-z,\- ]*?)\s+(.+)$/.exec(rule);
    if (m) {
      const d = days(m[1].replace(/\s/g, ''));
      const t = times(m[2]);
      if (!d || !t) return null;
      lines.push({ days: d, hours: t });
    } else {
      const t = times(rule);
      if (!t) return null;
      lines.push({ days: 'Every day', hours: t });
    }
  }
  return lines.length ? lines : null;
}

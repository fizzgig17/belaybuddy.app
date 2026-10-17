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

const DAY_INDEX: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function dayNumbers(spec: string): number[] | null {
  const out: number[] = [];
  for (const part of spec.split(',').map((p) => p.trim())) {
    const range = /^([A-Z][a-z])-([A-Z][a-z])$/.exec(part);
    if (range && range[1] in DAY_INDEX && range[2] in DAY_INDEX) {
      let d = DAY_INDEX[range[1]];
      const end = DAY_INDEX[range[2]];
      for (let i = 0; i < 7; i++) {
        out.push(d);
        if (d === end) break;
        d = (d + 1) % 7;
      }
    } else if (part in DAY_INDEX) out.push(DAY_INDEX[part]);
    else if (part !== 'PH') return null;
  }
  return out;
}

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Is the place open at `now` (device local time, which is right when you're near the gym)?
 * Returns null when the hours are missing or too unusual to read confidently.
 */
export function isOpenNow(raw: string | undefined, now = new Date()): boolean | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === '24/7') return true;
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let covered = false;
  let open = false;
  for (const rule of value.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = /^([A-Za-z][A-Za-z,\- ]*?)\s+(.+)$/.exec(rule);
    const dayList = m ? dayNumbers(m[1].replace(/\s/g, '')) : [0, 1, 2, 3, 4, 5, 6];
    const spec = (m ? m[2] : rule).trim();
    if (!dayList) return null;
    if (!dayList.includes(today)) continue;
    covered = true;
    // Later rules override earlier ones for the same day, as in OSM.
    open = false;
    if (/^(off|closed)$/i.test(spec)) continue;
    for (const r of spec.split(',').map((x) => x.trim())) {
      const t = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/.exec(r);
      if (!t) return null;
      const start = minutes(t[1]);
      const end = minutes(t[2]);
      if (end > start ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end) open = true;
    }
  }
  return covered ? open : null;
}

/** A web search for a place's hours: free, and opens in the browser. */
export function hoursSearchUrl(name: string, address?: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${address ?? ''} hours`.trim())}`;
}

/** The OpenStreetMap page for an "osm:way/123" style id, where anyone can fix or add hours. */
export function osmPageUrl(id: string): string | null {
  const m = /^osm:(node|way|relation)\/(\d+)$/.exec(id);
  return m ? `https://www.openstreetmap.org/${m[1]}/${m[2]}` : null;
}

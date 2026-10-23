// One Supabase client per environment, each with its own saved session; Prod and Dev never share a login.
// "Keep me signed in" (on by default) keeps it in the browser for up to 7 quiet days (30 days at most).
// Switched off, the session lives in the tab only and closing it signs you out.
const ENVS = window.BB_ENVS;
const clients = {};

const KEEP = 'bbdash-keep';
const LAST = 'bbdash-last-active';
const SINCE = 'bbdash-signed-in-at';
const DAY = 86400e3;
export const QUIET_DAYS = 7;
export const MAX_DAYS = 30;

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
export const keepSignedIn = {
  get: () => safe(() => localStorage.getItem(KEEP) !== '0', true),
  set: (v) => safe(() => localStorage.setItem(KEEP, v ? '1' : '0')),
};
// Supabase stores its session through this: the browser's long-term storage if "keep me signed in" is on.
const storage = {
  getItem: (k) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k)),
  setItem: (k, v) => safe(() => { const [on, off] = keepSignedIn.get() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]; on.setItem(k, v); off.removeItem(k); }),
  removeItem: (k) => safe(() => { localStorage.removeItem(k); sessionStorage.removeItem(k); }),
};

/** Notes that you are using the dashboard (at most once a minute), for the 7-day quiet rule. */
let lastTouch = 0;
export function touch() {
  const now = Date.now();
  if (now - lastTouch < 60e3) return;
  lastTouch = now;
  safe(() => { localStorage.setItem(LAST, String(now)); if (!localStorage.getItem(SINCE)) localStorage.setItem(SINCE, String(now)); });
}
/** True if the saved login is too old to trust: 7 quiet days, or 30 days since it began. */
export function sessionExpired() {
  const now = Date.now();
  const last = Number(safe(() => localStorage.getItem(LAST), 0)) || 0;
  const since = Number(safe(() => localStorage.getItem(SINCE), 0)) || 0;
  return (last && now - last > QUIET_DAYS * DAY) || (since && now - since > MAX_DAYS * DAY);
}
const clearStamps = () => safe(() => { localStorage.removeItem(LAST); localStorage.removeItem(SINCE); });

export const envNames = () => Object.keys(ENVS);
export const envLabel = (env) => ENVS[env].label;

export function client(env) {
  if (!clients[env]) {
    const { url, key } = ENVS[env];
    clients[env] = window.supabase.createClient(url, key, {
      auth: {
        storage,
        storageKey: `bbdash-${env}`,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return clients[env];
}

/** Calls a database function. Pass { schema: 'edc' } for EDC Roulette's functions (they live in the edc schema). */
export async function rpc(env, fn, args, { schema } = {}) {
  const c = client(env);
  const { data, error } = await (schema ? c.schema(schema) : c).rpc(fn, args || {});
  if (error) {
    const e = new Error(/Two-step/i.test(error.message) ? 'Two-step sign-in required' : /Not allowed/i.test(error.message) ? 'Not allowed' : error.message);
    e.code = e.message;
    throw e;
  }
  return data;
}

export async function signOutAll() {
  clearStamps();
  await Promise.all(envNames().map((e) => client(e).auth.signOut().catch(() => {})));
}

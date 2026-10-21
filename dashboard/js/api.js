// One Supabase client per environment, each with its own session kept in sessionStorage:
// closing the tab signs you out, and Prod and Dev never share a login.
const ENVS = window.BB_ENVS;
const clients = {};

export const envNames = () => Object.keys(ENVS);
export const envLabel = (env) => ENVS[env].label;

export function client(env) {
  if (!clients[env]) {
    const { url, key } = ENVS[env];
    clients[env] = window.supabase.createClient(url, key, {
      auth: {
        storage: window.sessionStorage,
        storageKey: `bbdash-${env}`,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return clients[env];
}

export async function rpc(env, fn, args) {
  const { data, error } = await client(env).rpc(fn, args || {});
  if (error) {
    const e = new Error(/Two-step/i.test(error.message) ? 'Two-step sign-in required' : /Not allowed/i.test(error.message) ? 'Not allowed' : error.message);
    e.code = e.message;
    throw e;
  }
  return data;
}

export async function signOutAll() {
  await Promise.all(envNames().map((e) => client(e).auth.signOut().catch(() => {})));
}

import { rpc, client, envNames, envLabel, signOutAll, touch, sessionExpired } from './api.js';
import { renderAuth } from './auth.js';
import { h, $, clear } from './util.js';
import { overviewView } from './overview.js';
import { usersView } from './users.js';
import { logView } from './log.js';
import { submissionsView } from './submissions.js';
import { hoursView } from './hours.js';
import { adminsView } from './admins.js';

const root = $('#app');

const store = {
  get env() { try { return sessionStorage.getItem('bbdash-env') || 'prod'; } catch { return 'prod'; } },
  set env(v) { try { sessionStorage.setItem('bbdash-env', v); } catch { /* ignore */ } },
  get tab() { return location.hash.replace('#', '') || 'overview'; },
};

const TABS = [
  ['overview', 'Overview'],
  ['users', 'Users'],
  ['submissions', 'Suggestions'],
  ['hours', 'Hours'],
  ['admins', 'Admins'],
  ['log', 'Deleted accounts'],
];
const VIEWS = { overview: overviewView, users: usersView, submissions: submissionsView, hours: hoursView, admins: adminsView, log: logView };
// Tabs that show how many items are waiting.
const BADGES = { submissions: 'submissions', hours: 'hours' };

// Logins last up to 7 quiet days (30 at most); using the page keeps the clock fresh.
['pointerdown', 'keydown', 'scroll'].forEach((e) => window.addEventListener(e, touch, { passive: true }));

function switchEnv(env) {
  store.env = env;
  start();
}

async function start() {
  const env = store.env;
  if (sessionExpired()) await signOutAll();
  clear(root);
  await renderAuth(root, env, envLabel(env), () => shell(env), () => switchEnv(env === 'prod' ? 'dev' : 'prod'));
}

async function shell(env) {
  touch();
  // Ask for something only admins can read. A non-admin gets a plain refusal, not a half-working page.
  try {
    await rpc(env, 'dash_overview');
  } catch (e) {
    const msg = e.code === 'Not allowed'
      ? 'This account is not a Belay Buddy admin in this environment.'
      : e.code === 'Two-step sign-in required' ? 'Two-step sign-in is required.' : e.message;
    clear(root).append(h('div', { class: 'center' }, h('div', { class: 'authcard' },
      h('h1', {}, 'No access'), h('div', { class: 'msg err' }, msg),
      h('button', { class: 'btn', onClick: async () => { await client(env).auth.signOut(); start(); } }, 'Sign out'))));
    return;
  }

  const view = h('main', {});
  const tabs = h('nav', { class: 'tabs', role: 'tablist' });
  const draw = () => {
    const tab = VIEWS[store.tab] ? store.tab : 'overview';
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === tab);
    clear(view);
    VIEWS[tab](view, env);
    window.scrollTo(0, 0);
  };
  TABS.forEach(([id, label]) => tabs.append(h('button', { role: 'tab', 'data-tab': id, onClick: () => { location.hash = id; } }, label, h('span', { class: 'badge hidden', 'data-badge': id }))));
  window.onhashchange = draw;
  const badges = async () => {
    try {
      const counts = await rpc(env, 'dash_queue_counts');
      for (const [tab, key] of Object.entries(BADGES)) {
        const el = tabs.querySelector(`[data-badge="${tab}"]`);
        if (!el) continue;
        el.textContent = counts[key] > 99 ? '99+' : String(counts[key]);
        el.classList.toggle('hidden', !counts[key]);
      }
    } catch { /* badges are a convenience; the tabs still work */ }
  };
  window.removeEventListener('bb-queues', window.__bbBadges || (() => {}));
  window.__bbBadges = badges;
  window.addEventListener('bb-queues', badges);

  const sw = h('div', { class: 'envswitch', role: 'group', 'aria-label': 'Environment' },
    envNames().map((e) => h('button', { class: `${e === env ? 'on' : ''} ${e}`, onClick: () => e !== env && switchEnv(e) }, envLabel(e))));
  const email = (await client(env).auth.getUser()).data.user?.email || '';

  clear(root).append(
    ...(env === 'dev' ? [h('div', { class: 'envstrip' }, 'DEV · test data, not the real site')] : []),
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'B'), 'Belay Buddy'),
      sw, h('div', { class: 'spacer' }),
      h('span', { class: 'small muted' }, email),
      h('button', { class: 'btn small', onClick: async () => { await signOutAll(); location.reload(); } }, 'Sign out')),
    tabs, view);
  draw();
  badges();
}

start();

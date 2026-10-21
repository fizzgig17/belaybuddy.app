import { rpc } from './api.js';
import { h, clear, fmt, dateStr } from './util.js';

export async function logView(view, env) {
  clear(view).append(h('div', { class: 'toolbar' }, h('h2', {}, 'Deleted accounts')), h('div', { class: 'empty' }, 'Loading…'));
  let rows;
  try { rows = await rpc(env, 'dash_deletion_log', { p_limit: 200 }); } catch (e) {
    clear(view).append(h('div', { class: 'msg err' }, e.message)); return;
  }
  const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'Deleted accounts'), h('span', { class: 'small muted' }, `${fmt(rows.length)} shown`)),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'A record of accounts removed from this dashboard: when, by whom, and the account id. No names or emails are kept.'),
    h('div', { class: 'tablewrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Deleted', 'By', 'Account id', 'Had signed up'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.length ? rows.map((r) => h('tr', {},
        h('td', {}, when(r.deleted_at)), h('td', {}, r.deleted_by_name || '–'),
        h('td', {}, h('code', { class: 'small' }, r.user_id)), h('td', {}, dateStr(r.account_created_at)))) : h('tr', {}, h('td', { colspan: 4, class: 'empty' }, 'Nothing has been deleted from here yet.'))))));
}

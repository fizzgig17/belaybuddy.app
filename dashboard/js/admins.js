import { rpc } from './api.js';
import { h, clear, dateStr } from './util.js';
import { modal } from './modal.js';

export async function adminsView(view, env, notice) {
  clear(view).append(h('div', { class: 'toolbar' }, h('h2', {}, 'Admins')), h('div', { class: 'empty' }, 'Loading…'));
  let rows;
  try { rows = await rpc(env, 'dash_admins'); } catch (e) {
    clear(view).append(h('div', { class: 'msg err' }, e.message)); return;
  }
  const reload = (msg) => adminsView(view, env, msg);

  const email = h('input', { class: 'input', type: 'email', placeholder: 'Email of an existing account', autocomplete: 'off' });
  const result = h('div', { class: 'small' });
  const add = h('button', { class: 'btn primary' }, 'Make admin');
  const run = async () => {
    if (!email.value.trim()) return;
    add.disabled = true;
    try {
      const name = await rpc(env, 'dash_add_admin', { p_email: email.value });
      if (name == null) { result.textContent = 'No account uses that email in this environment. They need to sign up first.'; result.className = 'small msg err'; add.disabled = false; return; }
      reload(`${name} is now an admin.`);
    } catch (e) { result.textContent = e.message; result.className = 'small msg err'; add.disabled = false; }
  };
  add.addEventListener('click', run);
  email.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  const remove = (r) => modal('Remove this admin?',
    h('p', { style: 'margin:0' }, `${r.email || r.display_name} will lose access to the Admin screen in the app and to this dashboard. Their account stays.`),
    [{ label: 'Cancel' }, { label: 'Remove', cls: 'danger', run: async (close) => {
      await rpc(env, 'dash_remove_admin', { p_user: r.user_id });
      close(); reload(`${r.email || r.display_name} is no longer an admin.`);
    } }]);

  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'Admins')),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'Admins review hours and suggestions, and can sign in here (with the two-step code). The account must already exist.'),
    ...(notice ? [h('div', { class: 'msg info', style: 'margin-bottom:12px' }, notice)] : []),
    h('div', { class: 'card', style: 'margin-bottom:14px' }, h('h3', {}, 'Add an admin'), h('div', { class: 'addrow' }, email, add), result),
    h('div', { class: 'tablewrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Admin', 'Name', 'Added by', 'Added', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', {}, h('span', { class: 'email' }, r.email || '(no email)'), r.is_me ? h('span', { class: 'chip', style: 'margin-left:8px' }, 'you') : null),
        h('td', {}, r.display_name), h('td', {}, r.added_by_email || '–'), h('td', {}, dateStr(r.added_at)),
        h('td', {}, r.is_me || rows.length < 2 ? null : h('button', { class: 'btn small', onClick: () => remove(r) }, 'Remove'))))))));
}

import { rpc } from './api.js';
import { h, clear, fmt, ago, dateStr, debounce } from './util.js';

const PAGE = 50;

export function usersView(view, env) {
  const st = { q: '', from: '', to: '', quiet: false, sort: 'created_desc', page: 0, rows: [], total: 0 };
  const selected = new Map(); // id -> email, kept across pages and searches

  const body = h('div', {});
  const bulk = h('div', { class: 'bulkbar hidden' });
  const status = h('span', { class: 'small muted' });

  const q = h('input', { class: 'input', type: 'search', placeholder: 'Search email or name', style: 'min-width:230px', onInput: debounce((e) => { st.q = e.target.value; st.page = 0; load(); }, 350) });
  const from = h('input', { class: 'input', type: 'date', 'aria-label': 'Signed up from', onChange: (e) => { st.from = e.target.value; st.page = 0; load(); } });
  const to = h('input', { class: 'input', type: 'date', 'aria-label': 'Signed up to', onChange: (e) => { st.to = e.target.value; st.page = 0; load(); } });
  const quiet = h('input', { type: 'checkbox', onChange: (e) => { st.quiet = e.target.checked; st.page = 0; load(); } });
  const sort = h('select', { class: 'input', 'aria-label': 'Sort', onChange: (e) => { st.sort = e.target.value; st.page = 0; load(); } },
    [['created_desc', 'Newest first'], ['created_asc', 'Oldest first'], ['seen_desc', 'Seen most recently'], ['email_asc', 'Email A to Z']].map(([v, l]) => h('option', { value: v }, l)));

  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'Users'), status),
    h('div', { class: 'toolbar' }, q,
      h('label', { class: 'small muted' }, 'Signed up from ', from), h('label', { class: 'small muted' }, 'to ', to),
      h('label', { class: 'small', style: 'display:flex;gap:6px;align-items:center' }, quiet, 'No activity yet'),
      sort),
    body, bulk);

  async function load() {
    status.textContent = 'Loading…';
    try {
      st.rows = await rpc(env, 'dash_users', {
        p_search: st.q || null, p_from: st.from || null, p_to: st.to || null, p_quiet: st.quiet,
        p_sort: st.sort, p_limit: PAGE, p_offset: st.page * PAGE,
      });
      st.total = st.rows[0] ? Number(st.rows[0].total) : 0;
      status.textContent = `${fmt(st.total)} account${st.total === 1 ? '' : 's'}`;
      renderTable();
    } catch (e) {
      status.textContent = '';
      clear(body).append(h('div', { class: 'msg err' }, e.message));
    }
  }

  function renderTable() {
    const selectable = st.rows.filter((r) => !r.is_admin);
    const all = h('input', {
      type: 'checkbox', 'aria-label': 'Select all on this page',
      checked: selectable.length > 0 && selectable.every((r) => selected.has(r.id)),
      onChange: (e) => { selectable.forEach((r) => (e.target.checked ? selected.set(r.id, r.email) : selected.delete(r.id))); renderTable(); },
    });
    const rows = st.rows.map((r) => h('tr', { class: selected.has(r.id) ? 'sel' : '' },
      h('td', {}, h('input', {
        type: 'checkbox', disabled: r.is_admin, 'aria-label': `Select ${r.email}`, checked: selected.has(r.id),
        onChange: (e) => { e.target.checked ? selected.set(r.id, r.email) : selected.delete(r.id); renderTable(); },
      })),
      h('td', {}, h('span', { class: 'email' }, r.email || '(no email)'), ' ', r.is_admin ? h('span', { class: 'chip' }, 'admin') : null),
      h('td', {}, r.display_name || h('span', { class: 'muted' }, '–')),
      h('td', {}, dateStr(r.created_at)),
      h('td', {}, ago(r.last_sign_in_at)),
      h('td', {}, r.providers || '–'),
      h('td', { class: 'num' }, r.saved), h('td', { class: 'num' }, r.sessions), h('td', { class: 'num' }, r.posts), h('td', { class: 'num' }, r.friends)));
    const table = h('div', { class: 'tablewrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, all), ...['Email', 'Name', 'Signed up', 'Last seen', 'Sign-in'].map((t) => h('th', {}, t)),
        ...['Saved', 'Sessions', 'Posts', 'Friends'].map((t) => h('th', { class: 'num' }, t)))),
      h('tbody', {}, rows.length ? rows : h('tr', {}, h('td', { colspan: 10, class: 'empty' }, 'No accounts match.')))));
    const last = Math.max(0, Math.ceil(st.total / PAGE) - 1);
    const pager = h('div', { class: 'pager' },
      h('span', {}, st.total ? `${st.page * PAGE + 1}–${Math.min(st.total, (st.page + 1) * PAGE)} of ${fmt(st.total)}` : ''),
      h('button', { class: 'btn small', disabled: st.page === 0, onClick: () => { st.page--; load(); } }, 'Previous'),
      h('button', { class: 'btn small', disabled: st.page >= last, onClick: () => { st.page++; load(); } }, 'Next'));
    clear(body).append(table, pager);
    renderBulk();
  }

  function renderBulk() {
    clear(bulk);
    bulk.classList.toggle('hidden', selected.size === 0);
    if (!selected.size) return;
    bulk.append(h('b', {}, `${selected.size} selected`),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn small', onClick: () => { selected.clear(); renderTable(); } }, 'Clear'),
      h('button', { class: 'btn danger small', onClick: confirmDelete }, 'Delete selected…'));
  }

  function confirmDelete() {
    const ids = [...selected.keys()];
    const emails = [...selected.values()];
    const word = env === 'prod' ? 'delete prod' : 'delete';
    const input = h('input', { class: 'input', placeholder: `Type “${word}” to confirm`, autocomplete: 'off' });
    const go = h('button', { class: 'btn danger', disabled: true }, `Delete ${ids.length} account${ids.length === 1 ? '' : 's'}`);
    const err = h('div', { class: 'msg err hidden' });
    input.addEventListener('input', () => { go.disabled = input.value.trim().toLowerCase() !== word; });
    const close = () => back.remove();
    const back = h('div', { class: 'modalback', onClick: (e) => e.target === back && close() },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h2', {}, `Delete ${ids.length} account${ids.length === 1 ? '' : 's'}?`),
        h('div', {}, h('span', { class: `chip ${env === 'prod' ? 'danger' : 'warn'}` }, env === 'prod' ? 'PRODUCTION' : 'DEV'),
          ' This permanently removes each account and everything it owns: profile, saved places, posts, messages, sessions, friends. It cannot be undone.'),
        h('ul', {}, emails.slice(0, 8).map((e) => h('li', {}, e || '(no email)')), emails.length > 8 ? h('li', {}, `…and ${emails.length - 8} more`) : null),
        input, err,
        h('div', { class: 'actions' }, h('button', { class: 'btn', onClick: close }, 'Cancel'), go)));
    go.addEventListener('click', async () => {
      go.disabled = true; input.disabled = true; go.textContent = 'Deleting…';
      try {
        let removed = 0;
        for (let i = 0; i < ids.length; i += 200) removed += await rpc(env, 'dash_delete_users', { p_ids: ids.slice(i, i + 200) });
        selected.clear(); close(); await load();
        status.textContent = `${fmt(removed)} account${removed === 1 ? '' : 's'} deleted. ${status.textContent}`;
      } catch (e) {
        err.textContent = e.message; err.classList.remove('hidden'); go.textContent = 'Try again'; go.disabled = false; input.disabled = false;
      }
    });
    document.body.append(back);
    input.focus();
  }

  load();
}

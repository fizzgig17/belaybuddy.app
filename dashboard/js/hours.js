import { rpc } from './api.js';
import { h, clear, ago } from './util.js';
import { safeLink, queuesChanged } from './modal.js';

const STATUSES = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];
let filter = 'pending';

export async function hoursView(view, env, notice) {
  clear(view).append(h('div', { class: 'toolbar' }, h('h2', {}, 'Opening hours')), h('div', { class: 'empty' }, 'Loading…'));
  let rows;
  try { rows = await rpc(env, 'dash_hours', { p_status: filter }); } catch (e) {
    clear(view).append(h('div', { class: 'msg err' }, e.message)); return;
  }
  const reload = (msg) => { queuesChanged(); return hoursView(view, env, msg); };
  const seg = h('div', { class: 'seg' }, STATUSES.map(([v, label]) =>
    h('button', { class: v === filter ? 'on' : '', onClick: () => { filter = v; hoursView(view, env); } }, label)));

  const review = async (r, approve, row) => {
    row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try { await rpc(env, 'dash_review_hours', { p_id: r.id, p_approve: approve }); reload(`${approve ? 'Approved' : 'Rejected'} hours for ${r.place_name || r.place_id}.`); }
    catch (e) { row.querySelectorAll('button').forEach((b) => { b.disabled = false; }); view.prepend(h('div', { class: 'msg err' }, e.message)); }
  };

  const rowFor = (r) => {
    const tr = h('tr', {});
    const current = r.approved_value || r.imported_value;
    tr.append(
      h('td', {}, h('div', { class: 'email' }, r.place_name || '(no name)'), h('div', { class: 'small muted' }, `${r.kind} · `, h('code', {}, r.place_id)),
        r.website ? h('div', { class: 'small' }, safeLink(r.website)) : null),
      h('td', { class: 'wrap' }, h('code', {}, r.value)),
      h('td', { class: 'wrap' }, current ? h('span', {}, h('code', {}, current), h('div', { class: 'small muted' }, r.approved_value ? 'approved earlier' : 'from the data source')) : h('span', { class: 'muted' }, 'none')),
      h('td', {}, h('div', {}, r.submitter_email || r.submitter_name), h('div', { class: 'small muted' }, ago(r.created_at))),
      h('td', {}, r.status === 'pending'
        ? h('div', { class: 'btnrow' }, h('button', { class: 'btn primary small', onClick: () => review(r, true, tr) }, 'Approve'), h('button', { class: 'btn small', onClick: () => review(r, false, tr) }, 'Reject'))
        : h('span', { class: `chip ${r.status === 'approved' ? '' : 'grey'}` }, r.status)));
    return tr;
  };

  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'Opening hours'), seg, h('button', { class: 'btn small', onClick: () => reload() }, 'Refresh')),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'Hours people suggest for gyms and shops. Approved hours replace the imported ones in the app and survive data refreshes.'),
    ...(notice ? [h('div', { class: 'msg info', style: 'margin-bottom:12px' }, notice)] : []),
    h('div', { class: 'tablewrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Place', 'Suggested', 'Now showing', 'From', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.length ? rows.map(rowFor) : h('tr', {}, h('td', { colspan: 5, class: 'empty' }, filter === 'pending' ? 'No hours waiting for review.' : 'Nothing here.'))))));
}

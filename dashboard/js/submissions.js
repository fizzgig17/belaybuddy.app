import { rpc } from './api.js';
import { h, clear, ago } from './util.js';
import { modal, field, safeLink, mapLink, queuesChanged } from './modal.js';

const VERDICTS = {
  probably_exists: ['warn', 'Probably already listed'],
  similar_nearby: ['grey', 'Similar place nearby'],
  missing: ['', 'Likely missing'],
  area_empty: ['', 'Nothing in this area'],
  needs_location: ['grey', 'Needs a location'],
};
const STATUSES = [['pending', 'Waiting'], ['added', 'Added'], ['duplicate', 'Duplicate'], ['rejected', 'Rejected'], ['all', 'All']];
const KIND = { gym: 'Gym', crag: 'Crag', shop: 'Shop' };
let filter = 'pending';

const OSM_HOURS = /^[A-Za-z0-9,;: /-]{3,200}$/;
const num = (v) => (String(v).trim() === '' ? NaN : Number(v));

export async function submissionsView(view, env, notice) {
  clear(view).append(h('div', { class: 'toolbar' }, h('h2', {}, 'Place suggestions')), h('div', { class: 'empty' }, 'Loading…'));
  let rows;
  try { rows = await rpc(env, 'dash_submissions', { p_status: filter }); } catch (e) {
    clear(view).append(h('div', { class: 'msg err' }, e.message)); return;
  }
  const reload = (msg) => { queuesChanged(); return submissionsView(view, env, msg); };

  const seg = h('div', { class: 'seg' }, STATUSES.map(([v, label]) =>
    h('button', { class: v === filter ? 'on' : '', onClick: () => { filter = v; submissionsView(view, env); } }, label)));

  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'Place suggestions'), seg,
      h('button', { class: 'btn small', onClick: () => reload() }, 'Refresh')),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'Gyms, crags and shops people say are missing. Each one was checked against the catalog when it arrived; the finding says why it may not be showing.'),
    ...(notice ? [h('div', { class: 'msg info', style: 'margin-bottom:12px' }, notice)] : []),
    rows.length ? h('div', { class: 'stack' }, rows.map((r) => card(r, env, reload))) : h('div', { class: 'empty' }, filter === 'pending' ? 'Nothing waiting. Suggestions from the app and website show up here.' : 'Nothing here.'));
}

function card(r, env, reload) {
  const f = r.findings || {};
  const [vcls, vlabel] = VERDICTS[f.verdict] || ['grey', 'Not checked'];
  const matches = f.name_matches || [];
  const kv = [['Address', r.address], ['Website', r.website ? safeLink(r.website) : null], ['Phone', r.phone], ['Hours (as typed)', r.hours_text],
    ['They searched for', r.searched_for], ['Notes', r.notes],
    ['Location', r.latitude != null ? h('span', {}, `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)} · `, mapLink(r.latitude, r.longitude)) : null]]
    .filter(([, v]) => v);

  const finding = h('div', { class: 'finding' },
    h('div', {}, h('span', { class: `chip ${vcls}` }, vlabel), ' ', f.summary || ''),
    (f.tips || []).length ? h('ul', { class: 'small muted tips' }, f.tips.map((t) => h('li', {}, t))) : null,
    matches.length ? h('div', { class: 'small' }, h('b', {}, 'Same or similar names: '),
      matches.map((m, i) => h('span', {}, i ? '; ' : '', `${m.name} (${KIND[m.kind] || m.kind}${m.distance_km != null ? `, ${m.distance_km} km` : ''}, `, h('code', {}, m.id), ')'))) : null,
    (f.nearest || []).length ? h('div', { class: 'small muted' }, `Nearest ${KIND[r.kind]?.toLowerCase() || 'place'}s: `, f.nearest.map((n) => `${n.name} (${n.distance_km} km)`).join(', ')) : null);

  const actions = r.status === 'pending'
    ? h('div', { class: 'btnrow' },
      h('button', { class: 'btn primary small', onClick: () => addDialog(r, env, reload) }, 'Add to catalog…'),
      h('button', { class: 'btn small', onClick: () => resolveDialog(r, env, reload, 'duplicate', matches[0]?.id) }, 'Duplicate'),
      h('button', { class: 'btn small', onClick: () => resolveDialog(r, env, reload, 'rejected') }, 'Reject'),
      h('button', { class: 'btn small', onClick: () => recheckDialog(r, env, reload) }, 'Re-check position'))
    : h('div', { class: 'small muted' }, `${r.status === 'added' ? 'Added' : r.status === 'duplicate' ? 'Marked duplicate' : 'Rejected'} ${ago(r.reviewed_at)}`,
      r.resolved_place_id ? h('span', {}, ' · ', h('code', {}, r.resolved_place_id)) : null, r.admin_note ? ` · “${r.admin_note}”` : '');

  return h('div', { class: 'card sub' },
    h('div', { class: 'top' }, h('h3', {}, r.name), h('span', { class: 'chip grey' }, KIND[r.kind] || r.kind),
      r.status !== 'pending' ? h('span', { class: `chip ${r.status === 'added' ? '' : 'grey'}` }, r.status) : null,
      h('span', { class: 'small muted', style: 'margin-left:auto' }, `${ago(r.created_at)} · `, r.submitter_email || r.submitter_name || 'deleted account')),
    finding,
    kv.length ? h('dl', { class: 'kv' }, kv.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])) : null,
    actions);
}

function addDialog(r, env, reload) {
  const inp = (v, props) => h('input', { class: 'input', value: v ?? '', ...props });
  const name = inp(r.name, { maxlength: '200' });
  const lat = inp(r.latitude, { inputmode: 'decimal', placeholder: '40.01234' });
  const lng = inp(r.longitude, { inputmode: 'decimal', placeholder: '-105.25678' });
  const address = inp(r.address, { maxlength: '300' });
  const website = inp(r.website, { maxlength: '300' });
  const phone = inp(r.phone, { maxlength: '40' });
  const hours = inp('', { placeholder: 'Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00' });
  const boulder = h('input', { type: 'checkbox' });
  const note = h('textarea', { class: 'input', rows: '2', maxlength: '500', placeholder: 'Note for yourself (optional)' });
  const body = h('div', { class: 'stack' },
    h('p', { class: 'small muted', style: 'margin:0' }, `Adds this ${KIND[r.kind]?.toLowerCase()} to the ${env === 'prod' ? 'live' : 'dev'} catalog. It shows for everyone straight away and survives data refreshes.`),
    field('Name', name),
    h('div', { class: 'two' }, field('Latitude', lat), field('Longitude', lng)),
    field('Address', address, r.kind === 'crag' ? 'Shown as the region for a crag.' : null),
    r.kind === 'crag' ? h('label', { class: 'small' }, boulder, ' Bouldering area') : null,
    field('Website', website), field('Phone', phone),
    r.kind !== 'crag' ? field('Opening hours', hours, r.hours_text ? `They typed: “${r.hours_text}”. Rewrite it in this form, or leave blank to skip.` : 'Leave blank to skip.') : null,
    note);
  modal(`Add “${r.name}”`, body, [
    { label: 'Cancel' },
    { label: 'Add to catalog', cls: 'primary', run: async (close) => {
      const la = num(lat.value), lo = num(lng.value);
      if (!(la >= -90 && la <= 90) || !(lo >= -180 && lo <= 180)) throw new Error('Enter a valid latitude and longitude.');
      if (hours.value.trim() && !OSM_HOURS.test(hours.value.trim())) throw new Error('Hours must look like Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00.');
      const id = await rpc(env, 'dash_add_submission', {
        p_id: r.id, p_name: name.value, p_lat: la, p_lng: lo, p_address: address.value, p_website: website.value, p_phone: phone.value,
        p_hours: r.kind === 'crag' ? null : hours.value, p_is_boulder: boulder.checked, p_note: note.value || null });
      close();
      reload(`Added “${name.value.trim()}” (${id}).`);
    } }]);
}

function resolveDialog(r, env, reload, status, placeId) {
  const id = h('input', { class: 'input', value: placeId || '', placeholder: 'osm:way/123 (optional)' });
  const note = h('textarea', { class: 'input', rows: '2', maxlength: '500', placeholder: status === 'duplicate' ? 'Note (optional)' : 'Why? (for your own records)' });
  modal(status === 'duplicate' ? 'Mark as duplicate' : 'Reject this suggestion',
    h('div', { class: 'stack' },
      h('p', { class: 'small muted', style: 'margin:0' }, `“${r.name}” leaves the waiting list. The person is not notified.`),
      status === 'duplicate' ? field('Existing place', id) : null, note),
    [{ label: 'Cancel' }, { label: status === 'duplicate' ? 'Mark duplicate' : 'Reject', cls: status === 'duplicate' ? 'primary' : 'danger', run: async (close) => {
      await rpc(env, 'dash_resolve_submission', { p_id: r.id, p_status: status, p_note: note.value || null, p_place_id: status === 'duplicate' ? (id.value.trim() || null) : null });
      close(); reload(`“${r.name}” marked ${status === 'duplicate' ? 'a duplicate' : 'rejected'}.`);
    } }]);
}

function recheckDialog(r, env, reload) {
  const lat = h('input', { class: 'input', value: r.latitude ?? '', inputmode: 'decimal' });
  const lng = h('input', { class: 'input', value: r.longitude ?? '', inputmode: 'decimal' });
  modal('Re-check with a corrected position',
    h('div', { class: 'stack' }, h('p', { class: 'small muted', style: 'margin:0' }, 'Runs the catalog check again from this position and saves it on the suggestion.'),
      h('div', { class: 'two' }, field('Latitude', lat), field('Longitude', lng))),
    [{ label: 'Cancel' }, { label: 'Re-check', cls: 'primary', run: async (close) => {
      const la = num(lat.value), lo = num(lng.value);
      if (!(la >= -90 && la <= 90) || !(lo >= -180 && lo <= 180)) throw new Error('Enter a valid latitude and longitude.');
      await rpc(env, 'dash_recheck_submission', { p_id: r.id, p_lat: la, p_lng: lo });
      close(); reload('Checked again.');
    } }]);
}


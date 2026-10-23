// EDC Roulette, inside this dashboard: usage of its optional online features and the review queue for
// brands people suggest. Same admins and 2-step sign-in as everything else here; the functions live in
// the `edc` schema (edcroulette.app repo, migration 0003) and each one checks dash_guard() first.
import { rpc } from './api.js';
import { h, clear, fmt, ago, dateStr } from './util.js';
import { stacked, color } from './charts.js';
import { modal, field, queuesChanged } from './modal.js';

const edc = (env, fn, args) => rpc(env, fn, args, { schema: 'edc' });
const STATUSES = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];
const CATEGORIES = ['Knife', 'Flashlight', 'Pen', 'Multi-tool', 'Watch', 'Wallet', 'Keychain', 'Other'];
let filter = 'pending';

const kpi = (label, value, sub, attn) =>
  h('div', { class: `card kpi ${attn && value > 0 ? 'attn' : ''}` },
    h('div', { class: 'label' }, label), h('div', { class: 'value' }, fmt(value)),
    sub ? h('div', { class: 'delta flat' }, sub) : null);

export async function edcView(view, env, notice) {
  clear(view).append(h('div', { class: 'toolbar' }, h('h2', {}, 'EDC Roulette')), h('div', { class: 'empty' }, 'Loading…'));
  let o, rows;
  try {
    [o, rows] = await Promise.all([edc(env, 'dash_edc_overview'), edc(env, 'dash_brands', { p_status: filter })]);
  } catch (e) {
    clear(view).append(h('div', { class: 'msg err' }, /does not exist|schema/i.test(e.message)
      ? `EDC Roulette's database part isn't set up in ${env === 'prod' ? 'Prod' : 'Dev'} yet (it arrives with that app's next release to master).`
      : e.message));
    return;
  }
  const reload = (msg) => { queuesChanged(); return edcView(view, env, msg); };
  const today = o.days[o.days.length - 1] || {};

  const usage = h('div', { class: 'chart' });
  const keys = [{ key: 'identify', label: 'Photo identifies' }, { key: 'pair', label: 'Coordinated spins' }];
  const seg = h('div', { class: 'seg' }, STATUSES.map(([v, label]) =>
    h('button', { class: v === filter ? 'on' : '', onClick: () => { filter = v; edcView(view, env); } }, label)));

  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'EDC Roulette'), h('button', { class: 'btn small', onClick: () => reload() }, 'Refresh')),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'The free app has no accounts yet, so these are counts of the optional online features, per day (phones are counted by a scrambled random id). Nothing here is tied to a person.'),
    ...(notice ? [h('div', { class: 'msg info', style: 'margin-bottom:12px' }, notice)] : []),
    h('div', { class: 'grid kpis' },
      kpi('Brands waiting', o.brands.pending, `${fmt(o.suggestions_7d)} suggestions in 7 days`, true),
      kpi('Brands approved', o.brands.approved, `${fmt(o.brands.rejected)} rejected`),
      kpi('Photo identifies today', today.identify, `${fmt(today.identify_phones)} phones`),
      kpi('Coordinated spins today', today.pair, `${fmt(today.pair_phones)} phones`)),
    h('div', { class: 'card' }, h('div', { class: 'head' }, h('div', {}, h('h3', {}, 'Last 14 days'), h('div', { class: 'sub' }, 'AI features used per day. Limits are per phone, per network address and overall (see the function settings).'))), usage),
    h('div', { style: 'height:14px' }),
    h('div', { class: 'toolbar' }, h('h2', { style: 'font-size:16px' }, 'Brands'), seg),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'People suggest brands that are missing from the list. Approve to add one for everyone (fix the spelling first if needed); merge a misspelling into the right brand so it is matched from then on; reject junk. Waiting brands are never shown to anyone else.'),
    rows.length ? h('div', { class: 'stack' }, rows.map((b) => brandCard(b, env, reload)))
      : h('div', { class: 'empty' }, filter === 'pending' ? 'Nothing waiting. Brand suggestions from the app show up here.' : 'Nothing here.'));

  stacked(usage, o.days, keys, keys.map((k) => k.key));
  // A little legend for the two series.
  usage.after(h('div', { class: 'legend' }, keys.map((k, i) => h('span', {}, h('i', { style: `background:${color(i)}` }), k.label))));
}

function brandCard(b, env, reload) {
  const similar = b.similar || [];
  const waiting = b.status === 'pending';
  const actions = waiting
    ? h('div', { class: 'btnrow' },
      h('button', { class: 'btn primary small', onClick: () => approveDialog(b, env, reload) }, 'Approve…'),
      similar.length ? h('button', { class: 'btn small', onClick: () => mergeDialog(b, similar, env, reload) }, 'Merge into…') : null,
      h('button', { class: 'btn small', onClick: () => act(env, b, 'reject', reload, `“${b.name}” rejected.`) }, 'Reject'))
    : b.status === 'rejected'
      ? h('div', { class: 'btnrow' }, h('button', { class: 'btn small', onClick: () => act(env, b, 'restore', reload, `“${b.name}” is waiting again.`) }, 'Move back to waiting'))
      : h('div', { class: 'btnrow' }, h('button', { class: 'btn small', onClick: () => approveDialog(b, env, reload) }, 'Edit…'));

  return h('div', { class: 'card sub' },
    h('div', { class: 'top' }, h('h3', {}, b.name),
      ...(b.categories || []).map((c) => h('span', { class: 'chip grey' }, c)),
      b.status !== 'pending' ? h('span', { class: `chip ${b.status === 'approved' ? '' : 'grey'}` }, b.status) : null,
      h('span', { class: 'small muted', style: 'margin-left:auto' },
        b.status === 'approved' ? `${(b.aliases || []).length} alias${(b.aliases || []).length === 1 ? '' : 'es'}` : `suggested ${b.suggested_count}× · first ${ago(b.created_at)}`)),
    waiting && similar.length
      ? h('div', { class: 'small' }, h('b', {}, 'Close to: '), similar.map((s, i) => h('span', {}, i ? ', ' : '', `${s.name} (${Math.round(s.score * 100)}%)`)))
      : null,
    (b.aliases || []).length ? h('div', { class: 'small muted' }, `Also matches: ${b.aliases.join(', ')}`) : null,
    b.reviewed_at ? h('div', { class: 'small muted' }, `Reviewed ${dateStr(b.reviewed_at)}`) : null,
    actions);
}

async function act(env, b, action, reload, msg) {
  try { await edc(env, 'dash_review_brand', { p_id: b.id, p_action: action }); reload(msg); } catch (e) { reload(`Could not do that: ${e.message}`); }
}

function approveDialog(b, env, reload) {
  const name = h('input', { class: 'input', value: b.name, maxlength: '60' });
  const aliases = h('input', { class: 'input', value: (b.aliases || []).join(', '), placeholder: 'other spellings, comma separated' });
  const cats = new Set(b.categories || []);
  const boxes = CATEGORIES.map((c) => {
    const box = h('input', { type: 'checkbox', checked: cats.has(c) });
    box.addEventListener('change', () => (box.checked ? cats.add(c) : cats.delete(c)));
    return h('label', { class: 'small', style: 'margin-right:12px' }, box, ` ${c}`);
  });
  const isEdit = b.status === 'approved';
  modal(isEdit ? `Edit “${b.name}”` : `Approve “${b.name}”`,
    h('div', { class: 'stack' },
      h('p', { class: 'small muted', style: 'margin:0' }, isEdit ? 'Changes show in the app within a day.' : 'It joins the brand list for everyone (the app picks it up within a day). Fix the spelling or capitalization first if needed.'),
      field('Name', name),
      field('Other spellings that should find it', aliases),
      h('div', {}, h('div', { class: 'small muted' }, 'Categories it is known for'), h('div', {}, boxes))),
    [{ label: 'Cancel' }, { label: isEdit ? 'Save' : 'Approve', cls: 'primary', run: async (close) => {
      if (!name.value.trim()) throw new Error('Enter a name.');
      await edc(env, 'dash_review_brand', {
        p_id: b.id, p_action: 'approve', p_name: name.value.trim(),
        p_aliases: aliases.value.split(',').map((a) => a.trim()).filter(Boolean), p_categories: [...cats] });
      close(); reload(`${isEdit ? 'Saved' : 'Approved'} “${name.value.trim()}”.`);
    } }]);
}

function mergeDialog(b, similar, env, reload) {
  const pick = h('select', { class: 'input' }, similar.map((s) => h('option', { value: s.id }, `${s.name} (${Math.round(s.score * 100)}% alike)`)));
  modal(`Merge “${b.name}” into an existing brand`,
    h('div', { class: 'stack' },
      h('p', { class: 'small muted', style: 'margin:0' }, `“${b.name}” becomes another spelling of the brand you pick, and this entry is removed. Next time someone types it, the app matches the real brand.`),
      field('Merge into', pick)),
    [{ label: 'Cancel' }, { label: 'Merge', cls: 'primary', run: async (close) => {
      await edc(env, 'dash_review_brand', { p_id: b.id, p_action: 'merge', p_into: pick.value });
      close(); reload(`Merged “${b.name}”.`);
    } }]);
}

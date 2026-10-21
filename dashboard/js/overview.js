import { rpc } from './api.js';
import { h, clear, fmt, pct, delta, ago } from './util.js';
import { barLine, lines, stacked, donut, legendRows, heatmap, color } from './charts.js';

const FEATURES = [
  { key: 'favorites', label: 'Places saved' },
  { key: 'sessions', label: 'Sessions started' },
  { key: 'logs', label: 'Climbs logged' },
  { key: 'posts', label: 'Belay-board posts' },
  { key: 'responses', label: 'Post responses' },
  { key: 'scans', label: 'Route AI scans' },
  { key: 'friendships', label: 'Friend requests' },
];
const LABELS = FEATURES.map((f) => f.key);

function kpi(label, value, sub, opts = {}) {
  return h('div', { class: `card kpi ${opts.attn && value > 0 ? 'attn' : ''}` },
    h('div', { class: 'label' }, label), h('div', { class: 'value' }, fmt(value)),
    sub ? h('div', { class: `delta ${sub.cls || 'flat'}` }, sub.text) : null);
}
function card(title, sub, body, extra) {
  return h('div', { class: 'card' }, h('div', { class: 'head' }, h('div', {}, h('h3', {}, title), sub ? h('div', { class: 'sub' }, sub) : null), extra), body);
}
function seg(options, current, onPick) {
  const wrap = h('div', { class: 'seg' });
  options.forEach(([v, label]) => wrap.append(h('button', { class: v === current ? 'on' : '', onClick: () => { onPick(v); [...wrap.children].forEach((b, i) => b.classList.toggle('on', options[i][0] === v)); } }, label)));
  return wrap;
}

export async function overviewView(view, env) {
  const loading = h('div', { class: 'empty' }, 'Loading…');
  view.append(loading);
  let o, series, br, places, ret;
  try {
    [o, series, br, places, ret] = await Promise.all([
      rpc(env, 'dash_overview'), rpc(env, 'dash_series', { p_days: 365 }), rpc(env, 'dash_breakdowns'),
      rpc(env, 'dash_top_places', { p_limit: 8 }), rpc(env, 'dash_retention', { p_weeks: 10 }),
    ]);
  } catch (e) {
    clear(view).append(h('div', { class: 'msg err' }, `Could not load: ${e.message}`));
    return;
  }

  // Total users over time: today's total, minus sign-ups that came after each day.
  let running = o.users - series.reduce((a, d) => a + d.signups, 0);
  for (const d of series) { running += d.signups; d.total = running; }

  const range = { days: 90 };
  const pick = () => series.slice(-range.days);

  const growth = h('div', { class: 'chart' });
  const active = h('div', { class: 'chart' });
  const usage = h('div', { class: 'chart' });
  const on = new Set(['sessions', 'logs', 'favorites', 'posts']);
  const usageLegend = h('div', { class: 'legend' });
  const draw = () => {
    barLine(growth, pick(), { barKey: 'signups', barLabel: 'new sign-ups', lineKey: 'total', lineLabel: 'total accounts' });
    lines(active, pick(), [{ key: 'active', label: 'active people' }], { average: true });
    const keys = FEATURES.filter((f) => on.has(f.key));
    stacked(usage, pick(), keys, LABELS);
    clear(usageLegend);
    FEATURES.forEach((f) => usageLegend.append(h('button', {
      class: on.has(f.key) ? '' : 'off', type: 'button',
      onClick: () => { on.has(f.key) ? on.delete(f.key) : on.add(f.key); draw(); },
    }, h('i', { style: `background:${color(LABELS.indexOf(f.key))}` }), f.label)));
  };

  const d7 = delta(o.new_7d, o.new_prev_7d);
  const attn = o.pending_edits + o.open_reports + o.open_ai_reports;
  const rangeSeg = seg([[30, '30 days'], [90, '90 days'], [180, '6 months'], [365, '1 year']], range.days, (v) => { range.days = v; draw(); });

  const top = Math.max(1, ...places.map((p) => p.score));
  const topList = places.length
    ? h('div', { class: 'rows' }, places.map((p) => h('div', {},
      h('div', { class: 'row' }, h('span', {}, p.name || p.area_id), h('span', { class: 'muted small' }, `${p.favorites} saved · ${p.home} home · ${p.posts} posts`)),
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.round((p.score / top) * 100)}%` })))))
    : h('div', { class: 'empty' }, 'Nothing saved or posted yet');

  const providers = h('div', { class: 'chart' });
  const styles = h('div', { class: 'chart' });
  const goals = h('div', { class: 'chart' });
  const results = h('div', { class: 'chart' });
  const retChart = h('div', { class: 'chart' });

  clear(view).append(
    h('div', { class: 'toolbar' }, h('h2', {}, 'Overview'),
      h('span', { class: 'small muted' }, `Updated ${ago(o.generated_at)}`),
      h('button', { class: 'btn small', onClick: () => { clear(view); overviewView(view, env); } }, 'Refresh')),
    h('div', { class: 'grid kpis' },
      kpi('Total accounts', o.users, { text: `${fmt(o.new_30d)} new in 30 days`, cls: 'flat' }),
      kpi('New this week', o.new_7d, d7),
      kpi('Active today', o.active_1d, { text: `${pct(o.active_1d, o.users)} of accounts`, cls: 'flat' }),
      kpi('Active in 7 days', o.active_7d, { text: `${pct(o.active_7d, o.users)} of accounts`, cls: 'flat' }),
      kpi('Active in 30 days', o.active_30d, { text: `Stickiness ${pct(o.active_1d, o.active_30d)} (today ÷ 30 days)`, cls: 'flat' }),
      kpi('Needs attention', attn, { text: `${o.pending_edits} hours · ${o.open_reports} reports · ${o.open_ai_reports} AI`, cls: attn ? 'down' : 'flat' }, { attn: true })),
    h('div', { class: 'toolbar' }, h('h2', { style: 'font-size:16px' }, 'Trends'), rangeSeg),
    h('div', { class: 'grid cols2' },
      card('Sign-ups and total accounts', 'Bars: new accounts per day. Line: total accounts. Deleted accounts no longer count, so past totals only include people still here.', growth),
      card('Active people per day', 'Anyone who signed in or did something that day. Thick line: 7-day average.', active)),
    card('What people are doing', 'Daily activity by feature. Click a name to show or hide it.', usage, null),
    usageLegend,
    h('div', { style: 'height:14px' }),
    h('div', { class: 'grid kpis' },
      kpi('Places saved', o.favorites), kpi('Home gyms set', o.home_gyms),
      kpi('Sessions', o.sessions), kpi('Climbs logged', o.logs),
      kpi('Board posts', o.posts, { text: `${fmt(o.posts_open)} open now`, cls: 'flat' }), kpi('Post responses', o.responses),
      kpi('Messages', o.messages), kpi('Friendships', o.friends, { text: `${fmt(o.friend_requests_pending)} pending`, cls: 'flat' }),
      kpi('Route AI scans', o.scans, { text: `${fmt(o.ai_allowed)} allowed · ${fmt(o.ai_denied)} declined`, cls: 'flat' }),
      kpi('Checked in now', o.checkins_now),
      kpi('Push: iPhone', o.push_ios), kpi('Push: Android', o.push_android),
      kpi('Gyms in catalog', o.gyms), kpi('Crags in catalog', o.crags), kpi('Shops in catalog', o.shops),
      kpi('Admins', o.admins)),
    h('div', { class: 'grid cols3' },
      card('Top places', 'Saved gyms and crags, home gyms (counted double) and board posts.', topList),
      card('How people sign in', null, providers, null),
      card('Climbing styles', 'From profiles.', styles)),
    h('div', { class: 'grid cols3' },
      card('Board goals', 'What people post sessions for.', goals),
      card('Climb results', 'Sends, flashes and attempts logged.', results),
      card('Retention', 'Rows are the week people signed up. Cells show the share who did something that many weeks later.', retChart)));

  draw();
  donut(providers, br.providers); providers.after(legendRows(br.providers));
  donut(styles, br.styles, 'No profiles set up yet'); styles.after(legendRows(br.styles));
  donut(goals, br.goals, 'No posts yet'); goals.after(legendRows(br.goals));
  donut(results, br.results, 'No climbs logged yet'); results.after(legendRows(br.results));
  heatmap(retChart, ret);
}

// d3 charts. Each function draws into a container element and redraws when the container resizes.
// Colors come from CSS variables so they follow light/dark mode.
const d3 = window.d3;
export const color = (i) => `var(--c${(i % 7) + 1})`;

let tipEl;
function tip() {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.style.display = 'none'; document.body.append(tipEl); }
  return tipEl;
}
function showTip(event, html) {
  const t = tip();
  t.replaceChildren();
  for (const line of html) {
    const row = document.createElement('div');
    if (line.b) { const b = document.createElement('b'); b.textContent = line.b; row.append(b); if (line.t) row.append(' ' + line.t); }
    else row.textContent = line.t;
    t.append(row);
  }
  t.style.display = 'block';
  const pad = 14, w = t.offsetWidth, hgt = t.offsetHeight;
  let x = event.clientX + pad, y = event.clientY + pad;
  if (x + w > window.innerWidth - 8) x = event.clientX - w - pad;
  if (y + hgt > window.innerHeight - 8) y = event.clientY - hgt - pad;
  t.style.left = `${Math.max(8, x)}px`; t.style.top = `${Math.max(8, y)}px`;
}
const hideTip = () => { if (tipEl) tipEl.style.display = 'none'; };

/** Runs draw(width) now and again whenever the container's width changes. */
function responsive(el, draw) {
  let last = 0;
  const run = () => {
    const w = Math.round(el.clientWidth);
    if (!w || w === last) return;
    last = w; hideTip(); draw(w);
  };
  run();
  if (el._ro) el._ro.disconnect();
  el._ro = new ResizeObserver(run);
  el._ro.observe(el);
}

function svgFor(el, w, h, m) {
  el.querySelectorAll('svg').forEach((s) => s.remove());
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img');
  return { svg, g: svg.append('g').attr('transform', `translate(${m.l},${m.t})`), iw: w - m.l - m.r, ih: h - m.t - m.b };
}

const dayFmt = d3.timeFormat('%b %-d');
const dayFull = d3.timeFormat('%a %b %-d, %Y');
const parse = (s) => d3.timeParse('%Y-%m-%d')(s);
const nfmt = d3.format(',');

function xTimeAxis(g, x, ih, w) {
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(w / 90))).tickFormat(dayFmt).tickSizeOuter(0));
}
function yAxis(g, y, iw, ticks = 4, right = false) {
  const ax = right ? d3.axisRight(y) : d3.axisLeft(y);
  const gy = g.append('g').attr('class', 'axis').attr('transform', right ? `translate(${iw},0)` : null)
    .call(ax.ticks(ticks).tickFormat(d3.format('~s')).tickSize(right ? 4 : 4));
  gy.select('.domain').remove();
  if (!right) g.insert('g', ':first-child').selectAll('line').data(y.ticks(ticks)).join('line').attr('class', 'grid-line').attr('x1', 0).attr('x2', iw).attr('y1', y).attr('y2', y);
}

/** Daily bars with a line on a second axis (sign-ups per day + total users). */
export function barLine(el, data, { barKey, barLabel, lineKey, lineLabel }) {
  responsive(el, (w) => {
    const H = 260, m = { t: 12, r: 44, b: 26, l: 36 };
    const { svg, g, iw, ih } = svgFor(el, w, H, m);
    const days = data.map((d) => parse(d.day));
    const x = d3.scaleBand().domain(days).range([0, iw]).padding(0.25);
    const yb = d3.scaleLinear().domain([0, Math.max(1, d3.max(data, (d) => d[barKey]))]).nice().range([ih, 0]);
    const yl = d3.scaleLinear().domain([0, Math.max(1, d3.max(data, (d) => d[lineKey]))]).nice().range([ih, 0]);
    yAxis(g, yb, iw);
    yAxis(g, yl, iw, 4, true);
    const xt = d3.scaleTime().domain(d3.extent(days)).range([x.bandwidth() / 2, iw - x.bandwidth() / 2]);
    xTimeAxis(g, xt, ih, w);
    g.selectAll('rect.bar').data(data).join('rect').attr('class', 'bar')
      .attr('x', (d, i) => x(days[i])).attr('width', x.bandwidth())
      .attr('y', (d) => yb(d[barKey])).attr('height', (d) => ih - yb(d[barKey]))
      .attr('rx', Math.min(3, x.bandwidth() / 2)).attr('fill', 'var(--c1)').attr('opacity', 0.85);
    g.append('path').datum(data).attr('fill', 'none').attr('stroke', 'var(--c2)').attr('stroke-width', 2.2).attr('stroke-linejoin', 'round')
      .attr('d', d3.line().x((d, i) => x(days[i]) + x.bandwidth() / 2).y((d) => yl(d[lineKey])).curve(d3.curveMonotoneX));
    const dot = g.append('circle').attr('r', 4).attr('fill', 'var(--c2)').attr('stroke', 'var(--surface)').attr('stroke-width', 2).style('display', 'none');
    svg.append('rect').attr('transform', `translate(${m.l},${m.t})`).attr('width', iw).attr('height', ih).attr('fill', 'transparent')
      .on('mousemove touchmove', function (ev) {
        const [mx] = d3.pointer(ev, this);
        const i = Math.max(0, Math.min(data.length - 1, Math.floor(mx / (iw / data.length))));
        const d = data[i];
        dot.style('display', null).attr('cx', x(days[i]) + x.bandwidth() / 2).attr('cy', yl(d[lineKey]));
        showTip(ev.touches ? ev.touches[0] : ev, [{ b: dayFull(days[i]) }, { b: nfmt(d[barKey]), t: barLabel }, { b: nfmt(d[lineKey]), t: lineLabel }]);
      })
      .on('mouseleave touchend', () => { dot.style('display', 'none'); hideTip(); });
  });
}

/** Lines over time, with an optional 7-day average drawn as a smoother line. */
export function lines(el, data, series, { average = false } = {}) {
  responsive(el, (w) => {
    const H = 240, m = { t: 12, r: 14, b: 26, l: 36 };
    const { svg, g, iw, ih } = svgFor(el, w, H, m);
    const days = data.map((d) => parse(d.day));
    const x = d3.scaleTime().domain(d3.extent(days)).range([0, iw]);
    const maxv = d3.max(data, (d) => d3.max(series, (s) => d[s.key]));
    const y = d3.scaleLinear().domain([0, Math.max(1, maxv)]).nice().range([ih, 0]);
    yAxis(g, y, iw); xTimeAxis(g, x, ih, w);
    const ma = (key) => data.map((_, i) => d3.mean(data.slice(Math.max(0, i - 6), i + 1), (d) => d[key]));
    series.forEach((s, si) => {
      const col = color(si);
      g.append('path').datum(data).attr('fill', 'none').attr('stroke', col).attr('stroke-width', average ? 1.2 : 2.2).attr('opacity', average ? 0.45 : 1)
        .attr('d', d3.line().x((d, i) => x(days[i])).y((d) => y(d[s.key])).curve(d3.curveMonotoneX));
      if (average) {
        const m7 = ma(s.key);
        g.append('path').datum(m7).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2.6)
          .attr('d', d3.line().x((d, i) => x(days[i])).y((d) => y(d)).curve(d3.curveMonotoneX));
      }
    });
    const rule = g.append('line').attr('y1', 0).attr('y2', ih).attr('stroke', 'var(--muted)').attr('stroke-dasharray', '3 3').style('display', 'none');
    svg.append('rect').attr('transform', `translate(${m.l},${m.t})`).attr('width', iw).attr('height', ih).attr('fill', 'transparent')
      .on('mousemove touchmove', function (ev) {
        const e = ev.touches ? ev.touches[0] : ev;
        const [mx] = d3.pointer(ev, this);
        const i = d3.bisector((d) => d).center(days, x.invert(mx));
        rule.style('display', null).attr('x1', x(days[i])).attr('x2', x(days[i]));
        showTip(e, [{ b: dayFull(days[i]) }, ...series.map((s) => ({ b: nfmt(data[i][s.key]), t: s.label }))]);
      })
      .on('mouseleave touchend', () => { rule.style('display', 'none'); hideTip(); });
  });
}

/** Stacked daily bars; `keys` is the list of series currently switched on. */
export function stacked(el, data, keys, labels) {
  responsive(el, (w) => {
    const H = 260, m = { t: 12, r: 14, b: 26, l: 36 };
    const { svg, g, iw, ih } = svgFor(el, w, H, m);
    const days = data.map((d) => parse(d.day));
    const x = d3.scaleBand().domain(days).range([0, iw]).padding(0.2);
    const stack = d3.stack().keys(keys.map((k) => k.key))(data);
    const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(stack, (s) => d3.max(s, (d) => d[1])) || 1)]).nice().range([ih, 0]);
    yAxis(g, y, iw);
    xTimeAxis(g, d3.scaleTime().domain(d3.extent(days)).range([x.bandwidth() / 2, iw - x.bandwidth() / 2]), ih, w);
    g.selectAll('g.layer').data(stack).join('g').attr('class', 'layer').attr('fill', (s) => color(labels.indexOf(s.key)))
      .selectAll('rect').data((s) => s).join('rect')
      .attr('x', (d, i) => x(days[i])).attr('width', x.bandwidth())
      .attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])));
    svg.append('rect').attr('transform', `translate(${m.l},${m.t})`).attr('width', iw).attr('height', ih).attr('fill', 'transparent')
      .on('mousemove touchmove', function (ev) {
        const e = ev.touches ? ev.touches[0] : ev;
        const [mx] = d3.pointer(ev, this);
        const i = Math.max(0, Math.min(data.length - 1, Math.floor(mx / (iw / data.length))));
        showTip(e, [{ b: dayFull(days[i]) }, ...keys.map((k) => ({ b: nfmt(data[i][k.key]), t: k.label }))]);
      })
      .on('mouseleave touchend', hideTip);
  });
}

/** Donut with the biggest slice's share in the middle. */
export function donut(el, items, empty = 'No data yet') {
  responsive(el, (w) => {
    el.querySelectorAll('svg,.empty').forEach((n) => n.remove());
    const total = d3.sum(items, (d) => d.count);
    if (!total) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = empty; el.append(d); return; }
    const size = Math.min(w, 200), r = size / 2;
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${size} ${size}`).style('max-width', `${size}px`).style('margin', '0 auto');
    const g = svg.append('g').attr('transform', `translate(${r},${r})`);
    const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r - 2).cornerRadius(4).padAngle(0.02);
    const arcs = d3.pie().sort(null).value((d) => d.count)(items);
    g.selectAll('path').data(arcs).join('path').attr('d', arc).attr('fill', (d, i) => color(i))
      .on('mousemove', (ev, d) => showTip(ev, [{ b: d.data.name }, { b: nfmt(d.data.count), t: `(${Math.round((d.data.count / total) * 100)}%)` }]))
      .on('mouseleave', hideTip);
    g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em').style('font-size', '22px').style('font-weight', 700).style('fill', 'var(--text)').text(nfmt(total));
    g.append('text').attr('text-anchor', 'middle').attr('dy', '1.4em').text('total');
  });
}

/** Legend rows for a donut or bar list. */
export function legendRows(items) {
  const wrap = document.createElement('div'); wrap.className = 'legend';
  items.forEach((d, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.cursor = 'default';
    const sw = document.createElement('i'); sw.style.background = color(i);
    b.append(sw, `${d.name} · ${nfmt(d.count)}`); wrap.append(b);
  });
  return wrap;
}

/** Cohort retention heatmap: rows are sign-up weeks, columns are weeks since joining. */
export function heatmap(el, rows) {
  responsive(el, (w) => {
    el.querySelectorAll('svg,.empty').forEach((n) => n.remove());
    const cohorts = [...new Set(rows.map((r) => r.cohort))];
    if (!cohorts.length || d3.sum(rows, (r) => (r.week_offset === 0 ? r.size : 0)) === 0) {
      const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'Not enough sign-ups yet'; el.append(d); return;
    }
    const maxOff = d3.max(rows, (r) => r.week_offset);
    const m = { t: 22, r: 6, b: 4, l: 86 };
    const cell = Math.max(22, Math.min(54, Math.floor((w - m.l - m.r) / (maxOff + 1))));
    const H = m.t + cohorts.length * (cell * 0.72) + m.b;
    const { g } = svgFor(el, Math.max(w, m.l + (maxOff + 1) * cell + m.r), H, m);
    const ch = cell * 0.72;
    const fmtW = d3.timeFormat('%b %-d');
    for (let o = 0; o <= maxOff; o++) g.append('text').attr('x', o * cell + cell / 2).attr('y', -8).attr('text-anchor', 'middle').text(o === 0 ? 'wk 0' : `+${o}`);
    cohorts.forEach((c, ri) => {
      const own = rows.filter((r) => r.cohort === c);
      const size = own[0].size;
      g.append('text').attr('x', -8).attr('y', ri * ch + ch / 2 + 4).attr('text-anchor', 'end').text(`${fmtW(parse(c))} (${size})`);
      own.forEach((r) => {
        const frac = size ? r.active / size : 0;
        g.append('rect').attr('x', r.week_offset * cell + 1).attr('y', ri * ch + 1).attr('width', cell - 2).attr('height', ch - 2).attr('rx', 5)
          .attr('fill', 'var(--accent)').attr('opacity', 0.1 + frac * 0.9)
          .on('mousemove', (ev) => showTip(ev, [{ b: `${fmtW(parse(c))} sign-ups`, t: `(${size})` }, { b: `${Math.round(frac * 100)}%`, t: `active ${r.week_offset === 0 ? 'in their first week' : `${r.week_offset} week${r.week_offset > 1 ? 's' : ''} later`} (${r.active})` }]))
          .on('mouseleave', hideTip);
        if (cell >= 34) g.append('text').attr('x', r.week_offset * cell + cell / 2).attr('y', ri * ch + ch / 2 + 4).attr('text-anchor', 'middle').style('fill', frac > 0.55 ? '#fff' : 'var(--text)').style('pointer-events', 'none').text(`${Math.round(frac * 100)}`);
      });
    });
  });
}

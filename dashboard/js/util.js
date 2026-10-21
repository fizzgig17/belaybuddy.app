// Tiny DOM helper. Text is always set with textContent / text nodes, never innerHTML, so names
// and emails from the database can't inject markup.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const nf = new Intl.NumberFormat('en-US');
export const fmt = (n) => (n == null ? '–' : nf.format(n));
export const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
export function ago(iso) {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 45) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
export const dateStr = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '–');
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export function delta(now, prev) {
  if (!prev && !now) return { text: 'no change', cls: 'flat' };
  if (!prev) return { text: `+${now} vs. 0 last week`, cls: 'up' };
  const d = Math.round(((now - prev) / prev) * 100);
  return { text: `${d > 0 ? '+' : ''}${d}% vs. last week`, cls: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' };
}

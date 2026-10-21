import { h } from './util.js';

/** A labeled form row. */
export const field = (label, input, hint) =>
  h('label', { class: 'fld' }, h('span', { class: 'small muted' }, label), input, hint ? h('span', { class: 'small muted' }, hint) : null);

/** Only web links are made clickable; anything else from the database is shown as plain text. */
export const safeLink = (url, text) =>
  /^https?:\/\//i.test(url || '')
    ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text || url)
    : h('span', {}, text || url || '–');

export const mapLink = (lat, lng) =>
  lat == null || lng == null ? null
    : h('a', { href: `https://www.openstreetmap.org/?mlat=${Number(lat)}&mlon=${Number(lng)}#map=17/${Number(lat)}/${Number(lng)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Open on map');

/** Tells the tab badges to recount (after approving, adding, and so on). */
export const queuesChanged = () => window.dispatchEvent(new Event('bb-queues'));

/**
 * A dialog. buttons: [{ label, cls, run(close) }]. A button with no run just closes.
 * If run throws, the message shows inside the dialog and nothing closes.
 */
export function modal(title, body, buttons) {
  const err = h('div', { class: 'msg err hidden' });
  const close = () => back.remove();
  const btns = buttons.map((b) => {
    const el = h('button', { class: `btn ${b.cls || ''}`, type: 'button' }, b.label);
    el.addEventListener('click', async () => {
      if (!b.run) return close();
      el.disabled = true;
      err.classList.add('hidden');
      try { await b.run(close); } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); } finally { el.disabled = false; }
    });
    return el;
  });
  const back = h('div', { class: 'modalback', onClick: (e) => e.target === back && close() },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('h2', {}, title), body, err, h('div', { class: 'actions' }, btns)));
  document.body.append(back);
  back.querySelector('input:not([type=checkbox]),textarea')?.focus();
  return { close };
}

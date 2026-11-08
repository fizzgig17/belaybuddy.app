import { client, keepSignedIn, touch } from './api.js';
import { h, clear } from './util.js';

const verifiedFactors = async (c) => {
  const { data } = await c.auth.mfa.listFactors();
  return (data?.all || []).filter((f) => f.status === 'verified');
};

/** Where this environment's sign-in stands: 'signin' | 'verify' | 'enroll' | 'ready'. */
export async function authState(env) {
  const c = client(env);
  const { data: s } = await c.auth.getSession();
  if (!s.session) return { phase: 'signin' };
  const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return { phase: 'ready', email: s.session.user.email };
  const f = await verifiedFactors(c);
  const totp = f.find((x) => x.factor_type === 'totp');
  if (totp) return { phase: 'verify', totpId: totp.id, email: s.session.user.email };
  return { phase: 'enroll', email: s.session.user.email };
}

const card = (...kids) => h('div', { class: 'center' }, h('div', { class: 'authcard' }, ...kids));
const logo = () => h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'B'), 'Belay Buddy Dashboard');

/** Draws the sign-in screens for one environment into `root`; calls onDone() once fully signed in. */
export async function renderAuth(root, env, label, onDone, onSwitchEnv) {
  const c = client(env);
  const st = await authState(env);
  if (st.phase === 'ready') { touch(); return onDone(st); }
  const again = () => renderAuth(root, env, label, onDone, onSwitchEnv);

  const msg = h('div', { class: 'msg err hidden' });
  const say = (t, cls = 'err') => { msg.textContent = t; msg.className = `msg ${cls}`; };
  const busy = (btn, on) => { btn.disabled = on; };
  const envPill = h('span', { class: `chip ${env === 'dev' ? 'warn' : ''}` }, label);

  const swapLink = h('button', { class: 'btn small', type: 'button', onClick: onSwitchEnv }, `Use ${env === 'prod' ? 'Dev' : 'Production'} instead`);
  const footer = h('div', { class: 'small muted' }, 'Only Belay Buddy admins can use this. ', swapLink);

  if (st.phase === 'signin') {
    // Remember that a code was emailed (until it expires), so going back or refreshing does not strand you:
    // the old code still works, and a new email can only be sent once a minute.
    const KEY = `bb-otp-${env}`;
    const saved = (() => {
      try {
        const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        return v && Date.now() - v.at < 55 * 60 * 1000 ? v : null;
      } catch { return null; }
    })();
    const remember = (to) => { try { sessionStorage.setItem(KEY, JSON.stringify({ email: to, at: Date.now() })); } catch { /* private mode */ } };
    const forget = () => { try { sessionStorage.removeItem(KEY); } catch { /* private mode */ } };

    const email = h('input', { class: 'input', type: 'email', placeholder: 'Your admin email', autocomplete: 'username', required: true });
    const keep = h('input', { type: 'checkbox', checked: keepSignedIn.get(), onChange: (e) => keepSignedIn.set(e.target.checked) });
    const keepRow = h('label', { class: 'small', style: 'display:flex;gap:8px;align-items:center' }, keep, 'Keep me signed in on this device for up to 7 days');
    const send = h('button', { class: 'btn primary', type: 'submit' }, 'Email me a code');
    const have = h('button', { class: 'btn small', type: 'button' }, 'I already have a code');
    const code = h('input', { class: 'input code hidden', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', placeholder: '000000' });
    const verify = h('button', { class: 'btn primary hidden', type: 'button' }, 'Sign in');
    const resend = h('button', { class: 'btn small hidden', type: 'button' }, 'Send a new code');
    const other = h('button', { class: 'btn small hidden', type: 'button' }, 'Use a different email');
    let sentTo = '';
    let timer = null;

    // The Resend button counts down the minute Supabase makes you wait between emails.
    const cooldown = (sentAt) => {
      clearInterval(timer);
      const tick = () => {
        const left = 60 - Math.floor((Date.now() - sentAt) / 1000);
        if (left > 0 && resend.isConnected) { resend.disabled = true; resend.textContent = `Send a new code (${left}s)`; return; }
        resend.disabled = false; resend.textContent = 'Send a new code';
        clearInterval(timer);
      };
      tick();
      if (resend.disabled) timer = setInterval(tick, 1000);
    };
    const showCode = (to, sentAt) => {
      sentTo = to; email.value = to; email.disabled = true;
      send.classList.add('hidden'); have.classList.add('hidden');
      for (const el of [code, verify, resend, other]) el.classList.remove('hidden');
      code.focus();
      cooldown(sentAt);
    };
    const sendCode = async (btn) => {
      const to = (sentTo || email.value).trim();
      if (!to) return say('Enter your email first.');
      busy(btn, true); msg.className = 'msg hidden';
      // shouldCreateUser: false so this page can never create an account.
      const { error } = await c.auth.signInWithOtp({ email: to, options: { shouldCreateUser: false } });
      busy(btn, false);
      if (error) {
        if (/only request this after|rate limit/i.test(error.message)) {
          // A code was already sent a moment ago: it still works, so go straight to entering it.
          showCode(to, Date.now() - 1000);
          return say('A code was sent in the last minute. Enter that one, or wait for the timer to send another.', 'info');
        }
        return say(/not allowed|signups/i.test(error.message) ? 'That email has no Belay Buddy account in this environment.' : error.message);
      }
      remember(to);
      showCode(to, Date.now());
      say(`We emailed a code to ${to}.`, 'info');
    };

    const form = h('form', { style: 'display:grid;gap:12px' }, email, keepRow, send, have, code, verify, resend, other);
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!sentTo) sendCode(send); });
    have.addEventListener('click', () => {
      if (!email.value.trim()) return say('Enter your email first, then tap this.');
      msg.className = 'msg hidden';
      showCode(email.value.trim(), 0);
    });
    resend.addEventListener('click', () => sendCode(resend));
    other.addEventListener('click', () => {
      forget(); clearInterval(timer); sentTo = ''; msg.className = 'msg hidden';
      email.disabled = false; email.value = ''; code.value = '';
      send.classList.remove('hidden'); have.classList.remove('hidden');
      for (const el of [code, verify, resend, other]) el.classList.add('hidden');
      email.focus();
    });
    const doVerify = async () => {
      busy(verify, true);
      const { error } = await c.auth.verifyOtp({ email: sentTo, token: code.value.trim(), type: 'email' });
      busy(verify, false);
      if (error) return say('That code did not work. Check it and try again.');
      forget(); clearInterval(timer);
      again();
    };
    verify.addEventListener('click', doVerify);
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') doVerify(); });
    clear(root).append(card(logo(), h('h1', {}, 'Sign in ', envPill), h('p', { class: 'muted', style: 'margin:0' }, 'Step 1 of 2: confirm your email.'), form, msg, footer));
    if (saved) {
      showCode(saved.email, saved.at);
      say(`We emailed a code to ${saved.email}. Enter it, or send a new one when the timer ends.`, 'info');
    }
    return;
  }

  if (st.phase === 'verify') {
    const out = h('button', { class: 'btn small', type: 'button', onClick: async () => { await c.auth.signOut(); again(); } }, 'Not you? Sign out');
    const kids = [logo(), h('h1', {}, 'Second step ', envPill), h('p', { class: 'muted', style: 'margin:0' }, `Signed in as ${st.email}.`)];
    const code = h('input', { class: 'input code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000' });
    const go = h('button', { class: 'btn primary', type: 'button' }, 'Unlock');
    const run = async () => {
      busy(go, true);
      const { error } = await c.auth.mfa.challengeAndVerify({ factorId: st.totpId, code: code.value.trim() });
      busy(go, false);
      if (error) return say('That code did not work. Codes change every 30 seconds.');
      again();
    };
    go.addEventListener('click', run);
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    kids.push(h('p', { class: 'muted small', style: 'margin:0' }, 'Tap the code field, then the one-time code suggestion above your keyboard (iPhone Passwords app, Face ID). Or type it from your authenticator app.'), code, go);
    kids.push(msg, out);
    clear(root).append(card(...kids));
    return;
  }

  // enroll: first time on this environment. Set up an authenticator app (the iPhone Passwords app works).
  const wrap = h('div', { style: 'display:grid;gap:12px' });
  clear(root).append(card(logo(), h('h1', {}, 'Set up 2-step ', envPill), wrap, msg));

  const startTotp = async () => {
    clear(wrap).append(h('div', { class: 'muted' }, 'Setting up…'));
    const { data: all } = await c.auth.mfa.listFactors();
    for (const f of all?.all || []) if (f.factor_type === 'totp' && f.status !== 'verified') await c.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Dashboard ${Date.now()}` });
    if (error) {
      clear(wrap).append(h('div', { class: 'msg err' }, `Could not start 2-step setup: ${error.message}. If this says MFA is disabled, switch on "TOTP (App Authenticator)" under Authentication → Multi-Factor in this Supabase project.`));
      return;
    }
    const code = h('input', { class: 'input code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000' });
    const go = h('button', { class: 'btn primary', type: 'button' }, 'Turn on 2-step');
    const run = async () => {
      busy(go, true);
      const { error: e2 } = await c.auth.mfa.challengeAndVerify({ factorId: data.id, code: code.value.trim() });
      busy(go, false);
      if (e2) return say('That code did not work. Check the app and try again.');
      again();
    };
    go.addEventListener('click', run);
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    clear(wrap).append(
      h('p', { class: 'muted', style: 'margin:0' }, `Signed in as ${st.email}. Scan this with an authenticator app (the iPhone Passwords app, 1Password, Google Authenticator), then enter the code it shows.`),
      h('img', { class: 'qr', alt: 'QR code for your authenticator app', src: data.totp.qr_code }),
      h('div', { class: 'small muted' }, 'Or type this key in:'), h('code', {}, data.totp.secret), code, go);
  };

  startTotp();
}

import { client, keepSignedIn, touch } from './api.js';
import { h, clear } from './util.js';

/** Face ID / Touch ID (a platform passkey) can only be used on a secure page in a browser that supports it. */
export const faceIdAvailable = () => !!window.PublicKeyCredential && window.isSecureContext;

// Ask for the phone's or laptop's own biometric, not a USB key.
const CREATE = { authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' } };
const GET = { userVerification: 'required' };

const verifiedFactors = async (c) => {
  const { data } = await c.auth.mfa.listFactors();
  return (data?.all || []).filter((f) => f.status === 'verified');
};
export async function hasFaceId(env) {
  return (await verifiedFactors(client(env))).some((f) => f.factor_type === 'webauthn');
}

/** Registers this device's Face ID as a second step. Needs an already-unlocked (2-step) session. */
export async function setupFaceId(env) {
  const c = client(env);
  const { error } = await c.auth.mfa.webauthn.register({ friendlyName: `Face ID ${new Date().toLocaleDateString()}` }, CREATE);
  if (error) return { ok: false, message: faceMessage(error) };
  return { ok: true };
}
function faceMessage(error) {
  const m = String(error.message || error);
  if (/cancel|abort|not allowed|timed out/i.test(m)) return 'Face ID was cancelled. Try again.';
  if (/disabled|not enabled|webauthn/i.test(m)) return `Face ID is not switched on for this Supabase project yet (${m}).`;
  return m;
}

/** Where this environment's sign-in stands: 'signin' | 'verify' | 'enroll' | 'ready'. */
export async function authState(env) {
  const c = client(env);
  const { data: s } = await c.auth.getSession();
  if (!s.session) return { phase: 'signin' };
  const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return { phase: 'ready', email: s.session.user.email };
  const f = await verifiedFactors(c);
  const totp = f.find((x) => x.factor_type === 'totp');
  const face = f.find((x) => x.factor_type === 'webauthn');
  if (totp || face) return { phase: 'verify', totpId: totp?.id, faceId: face?.id, email: s.session.user.email };
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
    const email = h('input', { class: 'input', type: 'email', placeholder: 'Your admin email', autocomplete: 'username', required: true });
    const keep = h('input', { type: 'checkbox', checked: keepSignedIn.get(), onChange: (e) => keepSignedIn.set(e.target.checked) });
    const keepRow = h('label', { class: 'small', style: 'display:flex;gap:8px;align-items:center' }, keep, 'Keep me signed in on this device for up to 7 days');
    const send = h('button', { class: 'btn primary', type: 'submit' }, 'Email me a code');
    const code = h('input', { class: 'input code hidden', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', placeholder: '000000' });
    const verify = h('button', { class: 'btn primary hidden', type: 'button' }, 'Sign in');
    let sentTo = '';
    const form = h('form', { style: 'display:grid;gap:12px' }, email, keepRow, send, code, verify);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sentTo) return;
      busy(send, true); msg.className = 'msg hidden';
      // shouldCreateUser: false so this page can never create an account.
      const { error } = await c.auth.signInWithOtp({ email: email.value.trim(), options: { shouldCreateUser: false } });
      busy(send, false);
      if (error) return say(/not allowed|signups/i.test(error.message) ? 'That email has no Belay Buddy account in this environment.' : error.message);
      sentTo = email.value.trim();
      email.disabled = true; send.classList.add('hidden');
      code.classList.remove('hidden'); verify.classList.remove('hidden'); code.focus();
      say(`We emailed a code to ${sentTo}.`, 'info');
    });
    const doVerify = async () => {
      busy(verify, true);
      const { error } = await c.auth.verifyOtp({ email: sentTo, token: code.value.trim(), type: 'email' });
      busy(verify, false);
      if (error) return say('That code did not work. Check it and try again.');
      again();
    };
    verify.addEventListener('click', doVerify);
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') doVerify(); });
    clear(root).append(card(logo(), h('h1', {}, 'Sign in ', envPill), h('p', { class: 'muted', style: 'margin:0' }, 'Step 1 of 2: confirm your email.'), form, msg, footer));
    return;
  }

  if (st.phase === 'verify') {
    const out = h('button', { class: 'btn small', type: 'button', onClick: async () => { await c.auth.signOut(); again(); } }, 'Not you? Sign out');
    const kids = [logo(), h('h1', {}, 'Second step ', envPill), h('p', { class: 'muted', style: 'margin:0' }, `Signed in as ${st.email}.`)];
    if (st.faceId && faceIdAvailable()) {
      const face = h('button', { class: 'btn primary', type: 'button' }, 'Unlock with Face ID');
      face.addEventListener('click', async () => {
        busy(face, true);
        const { error } = await c.auth.mfa.webauthn.authenticate({ factorId: st.faceId }, GET);
        busy(face, false);
        if (error) return say(faceMessage(error));
        again();
      });
      kids.push(face);
    }
    if (st.totpId) {
      const code = h('input', { class: 'input code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000' });
      const go = h('button', { class: `btn ${st.faceId ? '' : 'primary'}`, type: 'button' }, st.faceId ? 'Or unlock with a code' : 'Unlock');
      const run = async () => {
        busy(go, true);
        const { error } = await c.auth.mfa.challengeAndVerify({ factorId: st.totpId, code: code.value.trim() });
        busy(go, false);
        if (error) return say('That code did not work. Codes change every 30 seconds.');
        again();
      };
      go.addEventListener('click', run);
      code.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
      if (!st.faceId) kids.push(h('p', { class: 'muted small', style: 'margin:0' }, 'Enter the 6-digit code from your authenticator app.'));
      kids.push(code, go);
    }
    kids.push(msg, out);
    clear(root).append(card(...kids));
    return;
  }

  // enroll: first time on this environment. Face ID if this device has it, otherwise an authenticator app.
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

  if (faceIdAvailable()) {
    const face = h('button', { class: 'btn primary', type: 'button' }, 'Use Face ID');
    face.addEventListener('click', async () => {
      busy(face, true);
      const r = await setupFaceId(env);
      busy(face, false);
      if (!r.ok) return say(r.message);
      again();
    });
    clear(wrap).append(
      h('p', { class: 'muted', style: 'margin:0' }, `Signed in as ${st.email}. Step 2 of 2: use this device's Face ID (or fingerprint) as your second step.`),
      face, h('button', { class: 'btn', type: 'button', onClick: startTotp }, 'Use an authenticator app instead'));
  } else {
    startTotp();
  }
}

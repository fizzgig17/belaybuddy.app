// Delivers queued notifications (see migrations/*_notifications.sql) as iOS
// push notifications (APNs) and/or email (SMTP), per each user's settings.
//
// Called by the database (pg_net) right after something is queued, and by a
// once-a-minute cron retry. Requests must carry x-notify-secret.
//
// Secrets (set by .github/workflows/supabase-functions.yml):
//   NOTIFY_SECRET                      shared with Vault (notify_secret)
//   SITE_URL                           https://dev.belaybuddy.app or https://belaybuddy.app
//   APNS_KEY_P8, APNS_KEY_ID, APPLE_TEAM_ID, APNS_BUNDLE_ID   push (optional)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM     email (optional)
// Missing push or email secrets just skip that channel.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';
import nodemailer from 'npm:nodemailer@6.9.16';

type Item = {
  id: number;
  kind: 'response' | 'message' | 'reminder' | 'test';
  user_id: string;
  email: string | null;
  actor_name: string;
  post_id: string | null;
  thread_responder: string | null;
  area_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  here_now: boolean | null;
  goal: string | null;
  body: string | null;
  send_push: boolean;
  send_email: boolean;
  timezone: string | null;
};

const env = (k: string) => Deno.env.get(k)?.trim() || undefined;

const GOALS: Record<string, string> = {
  projecting: 'projecting',
  mileage: 'mileage',
  'learning-lead': 'learning to lead',
  'top-rope-laps': 'top-rope laps',
  bouldering: 'bouldering',
};

function when(item: Item): string {
  if (!item.starts_at) return '';
  const tz = item.timezone || 'America/New_York';
  const start = new Date(item.starts_at);
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  const day = start.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  if (item.here_now && start.getTime() <= Date.now()) return 'now';
  return day === today ? `today at ${time}` : `${day} at ${time}`;
}

/** Title, body, and the app path a tap should open. */
export function compose(item: Item): { title: string; body: string; path: string } {
  if (item.kind === 'test') {
    return {
      title: 'Test notification',
      body: 'Belay Buddy notifications are working on this device.',
      path: '/profile/settings',
    };
  }
  const gym = item.area_name ?? 'your gym';
  const postPath = `/partners/post?id=${item.post_id}`;
  if (item.kind === 'response') {
    const goal = item.goal ? `${GOALS[item.goal] ?? item.goal} ` : '';
    return {
      title: `${item.actor_name} is in`,
      body: `For your ${goal}session at ${gym}, ${when(item)}. Say hi in the chat.`,
      path: postPath,
    };
  }
  if (item.kind === 'message') {
    return {
      title: item.actor_name,
      body: item.body ?? 'New message',
      path: `/partners/chat?post=${item.post_id}&with=${item.thread_responder}`,
    };
  }
  return {
    title: 'Session in 30 minutes',
    body: `${gym}, ${when(item)}. Meet at the front desk and do a partner check.`,
    path: postPath,
  };
}

// --- APNs --------------------------------------------------------------------

let apnsJwt: { token: string; at: number } | null = null;

async function apnsToken(): Promise<string | null> {
  const p8 = env('APNS_KEY_P8');
  const keyId = env('APNS_KEY_ID');
  const team = env('APPLE_TEAM_ID');
  if (!p8 || !keyId || !team) return null;
  // Apple wants the token refreshed at most every 20 minutes, at least hourly.
  if (apnsJwt && Date.now() - apnsJwt.at < 40 * 60_000) return apnsJwt.token;
  const key = await importPKCS8(p8.replace(/\\n/g, '\n'), 'ES256');
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId }).setIssuer(team).setIssuedAt().sign(key);
  apnsJwt = { token, at: Date.now() };
  return token;
}

type PushResult = 'sent' | 'gone' | 'failed' | 'skipped';

async function sendPush(
  device: { token: string; environment: string },
  msg: { title: string; body: string; path: string },
  threadId: string,
): Promise<PushResult> {
  const jwt = await apnsToken();
  const topic = env('APNS_BUNDLE_ID') ?? 'app.belaybuddy.ios';
  if (!jwt) return 'skipped';
  const host = device.environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetch(`https://${host}/3/device/${device.token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: { alert: { title: msg.title, body: msg.body }, sound: 'default', 'thread-id': threadId },
      // expo-notifications exposes a remote payload's "body" key as `data`.
      body: { path: msg.path },
    }),
  });
  if (res.ok) return 'sent';
  const reason = (await res.json().catch(() => ({}))) as { reason?: string };
  console.warn('APNs', res.status, reason.reason);
  return res.status === 410 || reason.reason === 'BadDeviceToken' || reason.reason === 'Unregistered' ? 'gone' : 'failed';
}

// --- Email -------------------------------------------------------------------

let mailer: nodemailer.Transporter | null | undefined;

function getMailer() {
  if (mailer !== undefined) return mailer;
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  if (!host || !user || !pass) return (mailer = null);
  const port = Number(env('SMTP_PORT') ?? 465);
  // Short timeouts: a mail server that never answers must fail in seconds,
  // not hold up every other notification for minutes.
  mailer = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return mailer;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function sendEmail(to: string, msg: { title: string; body: string; path: string }, kind: Item['kind']) {
  const transport = getMailer();
  if (!transport) return false;
  const site = env('SITE_URL') ?? 'https://belaybuddy.app';
  const open = `${site}${msg.path}`;
  const settings = `${site}/profile/settings`;
  const subject = kind === 'message' ? `${msg.title} sent you a message` : msg.title;
  const action = kind === 'message' ? 'Reply' : 'Open Belay Buddy';
  await transport.sendMail({
    from: env('SMTP_FROM') ?? `Belay Buddy <${env('SMTP_USER')}>`,
    to,
    // Replies go to a monitored mailbox, not the no-reply sender.
    replyTo: env('SMTP_REPLY_TO') ?? 'support@belaybuddy.app',
    subject,
    text: `${msg.title}\n\n${msg.body}\n\n${action}: ${open}\n\nChange which emails you get: ${settings}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;color:#1F2D35">
<p style="font-size:18px;font-weight:700;margin:0 0 8px">${escape(msg.title)}</p>
<p style="font-size:16px;line-height:1.5;margin:0 0 20px">${escape(msg.body)}</p>
<p><a href="${open}" style="background:#0E7A80;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${action}</a></p>
<p style="font-size:13px;color:#5A6A70;margin-top:28px">You get this because of your Belay Buddy notification settings. <a href="${settings}" style="color:#0E7A80">Change which emails you get</a>.</p>
</div>`,
  });
  return true;
}

// --- Handler -----------------------------------------------------------------

Deno.serve(async (req) => {
  const secret = env('NOTIFY_SECRET');
  if (!secret || req.headers.get('x-notify-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await db.rpc('claim_notifications', { max_rows: 50 });
  if (error) {
    console.error('claim_notifications', error.message);
    return new Response(error.message, { status: 500 });
  }
  const items = (data ?? []) as Item[];
  if (items.length === 0) return Response.json({ sent: 0 });

  // All push tokens for these users in one query.
  const userIds = [...new Set(items.filter((i) => i.send_push).map((i) => i.user_id))];
  const { data: tokenRows } = userIds.length
    ? await db.from('push_tokens').select('token, user_id, environment').in('user_id', userIds)
    : { data: [] };
  const tokens = new Map<string, { token: string; environment: string }[]>();
  for (const t of tokenRows ?? []) {
    tokens.set(t.user_id, [...(tokens.get(t.user_id) ?? []), t]);
  }

  let sent = 0;
  const saveErrors: string[] = [];
  for (const item of items) {
    const msg = compose(item);
    const problems: string[] = [];
    let emailed = false;
    let pushed = 0;

    if (item.send_push) {
      for (const device of tokens.get(item.user_id) ?? []) {
        try {
          const result = await sendPush(device, msg, `${item.post_id ?? item.kind}`);
          if (result === 'sent') pushed++;
          if (result === 'gone') {
            await db.from('push_tokens').delete().eq('token', device.token);
            problems.push('push: Apple no longer knows a phone (removed it)');
          }
          if (result === 'failed') problems.push('push failed');
          if (result === 'skipped') problems.push('push: not set up on the server');
        } catch (e) {
          problems.push(`push: ${(e as Error).message}`);
        }
      }
    }

    if (item.send_email && item.email) {
      try {
        emailed = await sendEmail(item.email, msg, item.kind);
        if (!emailed) problems.push('no email server configured');
      } catch (e) {
        problems.push(`email: ${(e as Error).message}`);
      }
    }

    // Retry (up to 5 attempts) only if email failed outright; push failures
    // are usually per-device and not worth resending everything for.
    // A test is never retried: the person is watching and sees the error.
    const retry = item.kind !== 'test' && problems.some((p) => p.startsWith('email'));
    const { error: saveError } = await db.rpc('finish_notification', {
      p_id: item.id,
      p_retry: retry,
      p_emailed: emailed,
      p_pushed: pushed,
      p_error: problems.length ? problems.join('; ') : null,
    });
    if (saveError) {
      console.error('saving result', item.id, saveError.message);
      saveErrors.push(`${item.id}: ${saveError.message}`);
    }
    if (!retry) sent++;
  }

  return Response.json({ sent, claimed: items.length, saveErrors });
});

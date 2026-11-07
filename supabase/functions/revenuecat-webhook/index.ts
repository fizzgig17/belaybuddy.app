// RevenueCat webhook: keeps public.plus_status in step with who has Belay Buddy Plus.
// RevenueCat calls this on every purchase, renewal, cancellation and expiry
// (Integrations > Webhooks). The request must carry the shared secret in its
// Authorization header (set the same value as the REVENUECAT_WEBHOOK_SECRET secret).
//
// The app logs into RevenueCat with the Supabase user id, so app_user_id is the user.

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const ENTITLEMENT = 'plus';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RcEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
  entitlement_id?: string | null;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
};

const env = (k: string) => Deno.env.get(k)?.trim() || undefined;

Deno.serve(async (req) => {
  const secret = env('REVENUECAT_WEBHOOK_SECRET');
  const sent = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!secret || sent !== secret) return new Response('Forbidden', { status: 403 });
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

  let event: RcEvent;
  try {
    event = ((await req.json()) as { event?: RcEvent }).event ?? {};
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (event.type === 'TEST') return Response.json({ ok: true, test: true });

  // Only the Plus entitlement matters (events without entitlement info are treated as Plus: it is the only product).
  const ids = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
  if (ids.length > 0 && !ids.includes(ENTITLEMENT)) return Response.json({ ok: true, ignored: 'other entitlement' });

  const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const at = event.event_timestamp_ms ?? Date.now();
  const expires = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

  async function apply(userId: string | undefined, active: boolean) {
    if (!userId || !UUID.test(userId)) return; // anonymous RevenueCat ids are not our users
    const { data: current } = await db.from('plus_status').select('last_event_ms').eq('user_id', userId).maybeSingle();
    if (current && current.last_event_ms > at) return; // an older event arriving late
    const { error } = await db
      .from('plus_status')
      .upsert({ user_id: userId, active, expires_at: expires, last_event_ms: at, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION':
      case 'NON_RENEWING_PURCHASE':
      case 'SUBSCRIPTION_EXTENDED':
      case 'TEMPORARY_ENTITLEMENT_GRANT':
        await apply(event.app_user_id, true);
        break;
      // Cancelled or in billing trouble: Plus stays until the paid period (or grace period) ends.
      case 'CANCELLATION':
      case 'BILLING_ISSUE':
      case 'SUBSCRIPTION_PAUSED':
        await apply(event.app_user_id, true);
        break;
      case 'EXPIRATION':
        await apply(event.app_user_id, false);
        break;
      case 'TRANSFER':
        for (const from of event.transferred_from ?? []) await apply(from, false);
        for (const to of event.transferred_to ?? []) await apply(to, true);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('plus_status', (e as Error).message);
    return new Response('Could not save', { status: 500 }); // RevenueCat retries
  }
  return Response.json({ ok: true });
});

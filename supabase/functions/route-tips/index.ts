// Route AI technique tips. The app sends a wall photo and the holds the person confirmed;
// Claude names each hold's type, says how one might use it, and suggests one possible order.
//
// POST { image: <base64 JPEG, no prefix>, holds: [{ n, x, y, w, h }] }
//   -> { overview, order: number[], holds: [{ n, type, tip, foot }], caveats }
// Needs a signed-in user (JWT) and the ANTHROPIC_API_KEY secret. Limited per person per day.
// Nothing is stored: the photo goes to the model and is not kept by us.

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL = Deno.env.get('ROUTE_AI_MODEL') ?? 'claude-sonnet-5-5';
const DAILY_LIMIT = Number(Deno.env.get('ROUTE_AI_DAILY_LIMIT') ?? '20');
const MAX_HOLDS = 60;
const MAX_IMAGE_CHARS = 2_000_000; // base64 characters, about 1.5 MB

const HOLD_TYPES = ['jug', 'crimp', 'sloper', 'pinch', 'pocket', 'edge', 'volume', 'foot', 'unclear', 'not_a_hold'];

const SYSTEM = `You help climbers read routes from a photo of an indoor climbing wall.
You are given the photo and a numbered list of holds the climber says belong to one route. Each hold has its center (x from the left, y from the top) and size (w, h), all as fractions of the image.

For each hold, say what type it looks like and how a climber might use it. Then give one possible order to climb the holds, usually bottom to top.

Rules:
- Only describe what you can see. If you cannot tell, use the type "unclear" and say so. If a listed item is not a climbing hold (a rope, a quickdraw, a person, a shadow), use "not_a_hold".
- This is one possible way to climb the route, not the only way and not instruction. Never give safety, belay, or rope advice.
- Keep each tip to one or two short sentences: grip, where to put weight, which way to face or reach.
- Use plain words a beginner understands.`;

const TOOL = {
  name: 'report_route',
  description: 'Report the technique tips for the route.',
  input_schema: {
    type: 'object',
    properties: {
      overview: { type: 'string', description: 'Two or three sentences on what kind of climbing this route looks like.' },
      order: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Hold numbers in one possible order to climb them. Leave out not_a_hold items.',
      },
      holds: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            n: { type: 'integer' },
            type: { type: 'string', enum: HOLD_TYPES },
            tip: { type: 'string' },
            foot: { type: 'boolean', description: 'True if it looks more like a foothold.' },
          },
          required: ['n', 'type', 'tip'],
        },
      },
      caveats: { type: 'string', description: 'What you were unsure about, if anything.' },
    },
    required: ['overview', 'order', 'holds'],
  },
};

type HoldIn = { n: number; x: number; y: number; w: number; h: number };

function validate(body: unknown): { image: string; holds: HoldIn[] } | string {
  const b = body as { image?: unknown; holds?: unknown };
  if (typeof b?.image !== 'string' || b.image.length < 100) return 'Send a photo.';
  if (b.image.length > MAX_IMAGE_CHARS) return 'That photo is too large.';
  if (!Array.isArray(b.holds) || b.holds.length < 1) return 'Pick at least one hold.';
  if (b.holds.length > MAX_HOLDS) return `Too many holds (the most is ${MAX_HOLDS}).`;
  const holds: HoldIn[] = [];
  for (const h of b.holds as Record<string, unknown>[]) {
    const vals = [h.n, h.x, h.y, h.w, h.h];
    if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v))) return 'Bad hold data.';
    holds.push({ n: Math.round(h.n as number), x: h.x as number, y: h.y as number, w: h.w as number, h: h.h as number });
  }
  return { image: b.image.replace(/^data:image\/\w+;base64,/, ''), holds };
}

function describe(holds: HoldIn[]) {
  const f = (v: number) => v.toFixed(2);
  return holds.map((h) => `${h.n}: x=${f(h.x)} y=${f(h.y)} w=${f(h.w)} h=${f(h.h)}`).join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'Technique tips are not set up yet.' }, 503);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'Sign in to get technique tips.' }, 401);

  let parsed;
  try {
    parsed = validate(await req.json());
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (typeof parsed === 'string') return json({ error: parsed }, 400);

  const { data: allowed, error: quotaError } = await supabase.rpc('take_route_ai_quota', { p_limit: DAILY_LIMIT });
  if (quotaError) return json({ error: 'Could not check your limit. Try again.' }, 500);
  if (!allowed) return json({ error: `You have used today's ${DAILY_LIMIT} scans. Try again tomorrow.` }, 429);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: parsed.image } },
            { type: 'text', text: `Holds on this route:\n${describe(parsed.holds)}` },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 400);
    console.error('Anthropic error', res.status, text);
    let reason = '';
    try {
      reason = JSON.parse(text)?.error?.message ?? '';
    } catch {
      // Not JSON; leave the reason empty.
    }
    // 429/529 mean busy or overloaded; anything else is a setup problem worth seeing while we build this.
    const busy = res.status === 429 || res.status === 529 || res.status >= 500;
    return json(
      {
        error: busy
          ? 'The tip service is busy. Try again in a moment.'
          : `The tip service could not run (${res.status}${reason ? `: ${reason.slice(0, 160)}` : ''}).`,
      },
      502,
    );
  }
  const data = await res.json();
  const block = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
  const out = block?.input;
  if (!out || !Array.isArray(out.holds)) return json({ error: 'Could not read the tips. Try again.' }, 502);

  const known = new Set(parsed.holds.map((h) => h.n));
  return json({
    overview: String(out.overview ?? ''),
    order: (Array.isArray(out.order) ? out.order : []).filter((n: unknown) => typeof n === 'number' && known.has(n)),
    holds: out.holds
      .filter((h: { n: unknown }) => typeof h.n === 'number' && known.has(h.n))
      .map((h: { n: number; type: string; tip: string; foot?: boolean }) => ({
        n: h.n,
        type: HOLD_TYPES.includes(h.type) ? h.type : 'unclear',
        tip: String(h.tip ?? '').slice(0, 400),
        foot: Boolean(h.foot),
      })),
    caveats: typeof out.caveats === 'string' ? out.caveats : '',
  });
});

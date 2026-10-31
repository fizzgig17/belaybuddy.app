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
// A scan uses two calls: a quick photo check, then the tips.
const DAILY_LIMIT = Number(Deno.env.get('ROUTE_AI_DAILY_LIMIT') ?? '40');
const CHECK_MODEL = Deno.env.get('ROUTE_AI_CHECK_MODEL') ?? 'claude-haiku-5-5';
const MAX_HOLDS = 60;
const MAX_IMAGE_CHARS = 2_000_000; // base64 characters, about 1.5 MB

const REVIEW_SYSTEM = `You check hold detection for a climbing-route app.
A climber photographed an indoor climbing wall and tapped one hold of the route they want. Software then looked for every hold of that color and drew a numbered magenta box around each one it found. The route color is given as an rgb value.

Your job:
1. "remove": the numbers of boxes that are NOT a hold of the route color. Typical mistakes: a hold of a different color, a patch of the wall or its panels that is merely a similar tint, a rope, quickdraw, bolt, tag, sign, light, person, clothing, shadow, or a box that covers a cluster of several holds. Keep a box if it is on a hold of the route color, even if the hold is blurry, in shadow, or partly hidden.
2. "missed": holds of the route color that have NO box on them. Give the center of each as x (fraction from the left, 0 to 1) and y (fraction from the top, 0 to 1). Only list holds you are confident are the route color. When the climber's tap position is given, the route is one connected trail of holds in one area of the wall around it: list missed holds only if they belong to that trail, and put in "remove" any boxed hold of the same color that clearly belongs to a separate trail elsewhere. Do not list anything that already has a box. At most 40.

Always answer by calling the report_review tool, once. If the photo has nudity, sexual content, graphic violence, or anything not suitable for all ages, set unsafe to true and leave everything else empty. Do not identify or describe any person.`;

const REVIEW_TOOL = {
  name: 'report_review',
  description: 'Report which boxes to remove and which holds were missed.',
  input_schema: {
    type: 'object',
    properties: {
      remove: { type: 'array', items: { type: 'integer' }, description: 'Box numbers that are not holds of the route color.' },
      missed: {
        type: 'array',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
      },
      unsafe: { type: 'boolean' },
    },
    required: ['remove', 'missed'],
  },
};

const HOLD_TYPES = ['jug', 'crimp', 'sloper', 'pinch', 'pocket', 'edge', 'volume', 'foot', 'unclear', 'not_a_hold'];

const SYSTEM = `You help climbers read routes from a photo of an indoor climbing wall.
You are given the photo and a numbered list of holds the climber says belong to one route. Each hold has its center (x from the left, y from the top) and size (w, h), all as fractions of the image.

For each hold, say what type it looks like and how a climber might use it. Then give one possible order to climb the holds, usually bottom to top.

Always give your answer by calling the report_route tool, once.

Rules:
- If the photo has nudity, sexual content, graphic violence, or anything not suitable for all ages, set unsafe to true, leave everything else empty, and do not describe it.
- Only describe what you can see. If you cannot tell, use the type "unclear" and say so. If a listed item is not a climbing hold (a rope, a quickdraw, a person, a shadow), use "not_a_hold".
- This is one possible way to climb the route, not the only way and not instruction. Never give safety, belay, or rope advice.
- Never suggest dynamic or jumping moves, letting go, dropping, or anything that relies on falling safely. Never advise on falling, downclimbing, spotting, or pad placement.
- Never say or imply that someone can or should be able to do the route, or that a move is easy or safe. Do not rate difficulty or grade the route.
- Describe holds and body positions as possibilities ("could", "one option is"), not as instructions. If a hold or move looks risky, uncertain, or beyond what you can judge from a photo, say to ask a gym staff member or instructor.
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
      unsafe: { type: 'boolean', description: 'True if the photo is not suitable for all ages. Then leave the rest empty.' },
    },
    required: ['overview', 'order', 'holds'],
  },
};


const CHECK_SYSTEM = `You look at a photo someone chose for a climbing app and say what it shows.
Always answer by calling the report_photo tool, once.
- kind "climbing_wall": an indoor climbing wall, bouldering wall, or outdoor rock face with climbing holds or routes.
- kind "other": anything else.
- kind "unsafe": nudity, sexual content, graphic violence, or anything not suitable for all ages. Leave "what" empty and never describe it.
"what" is a short, plain, G-rated description (under 12 words), like "an indoor climbing wall with colorful holds" or "a ceiling fan". Do not identify or name any person.`;

const CHECK_TOOL = {
  name: 'report_photo',
  description: 'Report what the photo shows.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['climbing_wall', 'other', 'unsafe'] },
      what: { type: 'string' },
    },
    required: ['kind', 'what'],
  },
};

type HoldIn = { n: number; x: number; y: number; w: number; h: number; xCm?: number; yCm?: number };
type Wall = { overhangDeg: number };

function validate(body: unknown): { image: string; holds: HoldIn[]; wall?: Wall } | string {
  const b = body as { image?: unknown; holds?: unknown; wall?: { overhangDeg?: unknown } };
  if (typeof b?.image !== 'string' || b.image.length < 100) return 'Send a photo.';
  if (b.image.length > MAX_IMAGE_CHARS) return 'That photo is too large.';
  if (!Array.isArray(b.holds) || b.holds.length < 1) return 'Pick at least one hold.';
  if (b.holds.length > MAX_HOLDS) return `Too many holds (the most is ${MAX_HOLDS}).`;
  const holds: HoldIn[] = [];
  for (const h of b.holds as Record<string, unknown>[]) {
    const vals = [h.n, h.x, h.y, h.w, h.h];
    if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v))) return 'Bad hold data.';
    const hold: HoldIn = { n: Math.round(h.n as number), x: h.x as number, y: h.y as number, w: h.w as number, h: h.h as number };
    if (typeof h.xCm === 'number' && typeof h.yCm === 'number' && Number.isFinite(h.xCm) && Number.isFinite(h.yCm)) {
      hold.xCm = Math.round(h.xCm);
      hold.yCm = Math.round(h.yCm);
    }
    holds.push(hold);
  }
  const wall =
    typeof b.wall?.overhangDeg === 'number' && Number.isFinite(b.wall.overhangDeg)
      ? { overhangDeg: Math.max(-60, Math.min(90, Math.round(b.wall.overhangDeg))) }
      : undefined;
  return { image: b.image.replace(/^data:image\/\w+;base64,/, ''), holds, wall };
}

function describe(holds: HoldIn[], wall?: Wall) {
  const f = (v: number) => v.toFixed(2);
  const lines = holds.map(
    (h) =>
      `${h.n}: x=${f(h.x)} y=${f(h.y)} w=${f(h.w)} h=${f(h.h)}` +
      (h.xCm != null ? ` | measured: ${h.xCm} cm right, ${h.yCm} cm up the wall from hold 1` : ''),
  );
  let text = `Holds on this route:\n${lines.join('\n')}`;
  if (wall) {
    const a = wall.overhangDeg;
    const kind = Math.abs(a) < 5 ? 'about vertical' : a > 0 ? `overhanging by about ${a} degrees` : `a slab leaning back about ${-a} degrees`;
    text += `\n\nA phone LiDAR scan measured the wall as ${kind}. The "measured" distances are real distances along the wall (approximate, a few centimeters off). Use them to judge reaches and how far apart moves are, and say when a move looks long or short.`;
  }
  return text;
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

  // Photos only go to the AI service for people who said yes (saved on their profile).
  const { data: profile } = await supabase.from('profiles').select('ai_consent').eq('id', userData.user.id).maybeSingle();
  if (profile?.ai_consent !== 'allowed') {
    return json({ error: 'Turn on AI features in Settings to use this.', code: 'ai-consent' }, 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  if ((body as { mode?: unknown })?.mode === 'check') {
    const image = (body as { image?: unknown }).image;
    if (typeof image !== 'string' || image.length < 100 || image.length > MAX_IMAGE_CHARS) {
      return json({ error: 'Send a photo.' }, 400);
    }
    const { data: ok } = await supabase.rpc('take_route_ai_quota', { p_limit: DAILY_LIMIT });
    if (!ok) return json({ error: `You have used today's scans. Try again tomorrow.` }, 429);
    const checkRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: CHECK_MODEL,
        max_tokens: 300,
        system: CHECK_SYSTEM,
        tools: [CHECK_TOOL],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } },
              { type: 'text', text: 'What does this photo show?' },
            ],
          },
        ],
      }),
    });
    if (!checkRes.ok) {
      console.error('Anthropic check error', checkRes.status, (await checkRes.text()).slice(0, 300));
      return json({ kind: 'unknown', what: '' });
    }
    const checkData = await checkRes.json();
    const out = (checkData.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input;
    const kind = ['climbing_wall', 'other', 'unsafe'].includes(out?.kind) ? out.kind : 'unknown';
    return json({ kind, what: kind === 'unsafe' ? '' : String(out?.what ?? '').slice(0, 120) });
  }

  if ((body as { mode?: unknown })?.mode === 'review') {
    const b = body as { image?: unknown; color?: unknown; holds?: unknown; tap?: { x?: unknown; y?: unknown } };
    if (typeof b.image !== 'string' || b.image.length < 100 || b.image.length > MAX_IMAGE_CHARS) {
      return json({ error: 'Send a photo.' }, 400);
    }
    const color = typeof b.color === 'string' ? b.color.slice(0, 40) : '';
    const tap =
      typeof b.tap?.x === 'number' && typeof b.tap?.y === 'number' && b.tap.x >= 0 && b.tap.x <= 1 && b.tap.y >= 0 && b.tap.y <= 1
        ? ` The climber tapped a hold at x=${b.tap.x.toFixed(2)}, y=${b.tap.y.toFixed(2)} (fractions from the left and top).`
        : '';
    const known = new Set<number>(
      Array.isArray(b.holds)
        ? (b.holds as { n?: unknown }[]).map((h) => h?.n).filter((n): n is number => typeof n === 'number')
        : [],
    );
    if (known.size < 1 || known.size > 200) return json({ error: 'Pick a color first.' }, 400);
    const { data: ok } = await supabase.rpc('take_route_ai_quota', { p_limit: DAILY_LIMIT });
    if (!ok) return json({ error: `You have used today's ${DAILY_LIMIT} AI checks. Try again tomorrow.` }, 429);
    const reviewRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: REVIEW_SYSTEM,
        tools: [REVIEW_TOOL],
        tool_choice: { type: 'tool', name: 'report_review' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b.image.replace(/^data:image\/\w+;base64,/, '') } },
              { type: 'text', text: `Route color: ${color || 'the color of the tapped hold'}. Boxes are numbered ${[...known].sort((x, y) => x - y).join(', ')}.${tap}` },
            ],
          },
        ],
      }),
    });
    if (!reviewRes.ok) {
      console.error('Anthropic review error', reviewRes.status, (await reviewRes.text()).slice(0, 300));
      const busy = reviewRes.status === 429 || reviewRes.status === 529 || reviewRes.status >= 500;
      return json({ error: busy ? 'The AI service is busy. Try again in a moment.' : 'The AI check could not run.' }, 502);
    }
    const reviewData = await reviewRes.json();
    const out = (reviewData.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input;
    if (out?.unsafe === true) return json({ unsafe: true, remove: [], missed: [] });
    if (!out || !Array.isArray(out.remove)) return json({ error: 'Could not read the check. Try again.' }, 502);
    return json({
      remove: out.remove.filter((n: unknown) => typeof n === 'number' && known.has(n)),
      missed: (Array.isArray(out.missed) ? out.missed : [])
        .filter(
          (p: { x?: unknown; y?: unknown }) =>
            typeof p?.x === 'number' && typeof p?.y === 'number' && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
        )
        .slice(0, 40)
        .map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
    });
  }

  const parsed = validate(body);
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: parsed.image } },
            { type: 'text', text: describe(parsed.holds, parsed.wall) },
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
  if (out?.unsafe === true) return json({ unsafe: true });
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

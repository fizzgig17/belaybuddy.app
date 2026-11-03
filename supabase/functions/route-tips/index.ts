// Route tag reader. The app sends a photo of a climbing route's tag; Claude reads the grade, name and setter, and
// names the color of the hold the tag is attached to.
//
// POST { mode: 'tag', image: <base64 JPEG, no prefix> }
//   -> { found, grade, color, name, setter } | { found: false, unsafe: true }
// Needs a signed-in user (JWT) who turned on AI features, and the ANTHROPIC_API_KEY secret. Limited per person per day.
// Nothing is stored: the photo goes to the model and is not kept by us.
// (The function keeps its old name, route-tips, so existing deploys and app builds keep working.)

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL = Deno.env.get('ROUTE_AI_MODEL') ?? 'claude-sonnet-5-5';
const DAILY_LIMIT = Number(Deno.env.get('ROUTE_AI_DAILY_LIMIT') ?? '40');
const MAX_IMAGE_CHARS = 2_000_000; // base64 characters, about 1.5 MB

const COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'white', 'black', 'gray', 'brown'];

const TAG_SYSTEM = `You read the tag or label on an indoor climbing route or boulder problem from a photo. Tags are small cards or stickers hung from or placed next to the first hold of the route, with a grade (like 5.10a, 5.9+, V4, V3-4), sometimes a name, a setter, a date, and sometimes a color.
Report only what is clearly printed or written. Never guess a grade that is not legible. If there is no tag, or no grade can be read, set found to false.
Grade: copy it as written, e.g. "5.10b", "5.11+", "V4". Ignore other grading systems (French, Font) unless that is the only grade shown, then copy it as written.
Hold color: the route's color is the color of the hold the tag hangs from or sits against (the hold nearest the tag, not the wall or other holds in the background). Judge it from the hold itself and pick the closest from this list: ${COLORS.join(', ')}. Use an empty string if you cannot tell which hold the tag belongs to or its color is unclear.
Printed color: if the tag itself names or prints a color, give it in "printed_color", else leave it empty.
Do not identify or describe any person. If the photo has nudity, sexual content or graphic violence, set unsafe to true.
Always answer by calling the report_tag tool, once.`;

const TAG_TOOL = {
  name: 'report_tag',
  description: 'Report what the route tag says and the color of the hold it is on.',
  input_schema: {
    type: 'object',
    properties: {
      found: { type: 'boolean', description: 'True only if a legible grade was read.' },
      grade: { type: 'string' },
      hold_color: { type: 'string', description: `Color of the hold the tag is on: one of ${COLORS.join(', ')}, or empty.` },
      printed_color: { type: 'string', description: 'A color named or printed on the tag itself, else empty.' },
      name: { type: 'string', description: 'Route name if printed, else empty.' },
      setter: { type: 'string', description: 'Setter name if printed, else empty.' },
      unsafe: { type: 'boolean' },
    },
    required: ['found'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'Tag reading is not set up yet.' }, 503);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'Sign in to read route tags.' }, 401);

  // Photos only go to the AI service for people who said yes (saved on their profile).
  const { data: profile } = await supabase.from('profiles').select('ai_consent').eq('id', userData.user.id).maybeSingle();
  if (profile?.ai_consent !== 'allowed') {
    return json({ error: 'Turn on AI features in Settings to use this.', code: 'ai-consent' }, 403);
  }

  let body: { mode?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (body?.mode !== 'tag') return json({ error: 'Unknown request.' }, 400);
  const image = body.image;
  if (typeof image !== 'string' || image.length < 100 || image.length > MAX_IMAGE_CHARS) {
    return json({ error: 'Send a photo.' }, 400);
  }

  const { data: ok } = await supabase.rpc('take_route_ai_quota', { p_limit: DAILY_LIMIT });
  if (!ok) return json({ error: `You have used today's ${DAILY_LIMIT} AI scans. Try again tomorrow.` }, 429);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: TAG_SYSTEM,
      tools: [TAG_TOOL],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } },
            { type: 'text', text: 'Read this route tag and the hold it is on. Answer with the report_tag tool.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error('Anthropic tag error', res.status, (await res.text()).slice(0, 300));
    const busy = res.status === 429 || res.status === 529 || res.status >= 500;
    return json({ error: busy ? 'The AI service is busy. Try again in a moment.' : 'The tag could not be read.' }, 502);
  }
  const data = await res.json();
  const out = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use')?.input;
  if (out?.unsafe === true) return json({ found: false, unsafe: true });
  const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const pickColor = (v: unknown) => {
    const c = clean(v, 30).toLowerCase().replace('grey', 'gray');
    return COLORS.find((k) => c === k || c.includes(k)) ?? '';
  };
  const grade = clean(out?.grade, 12);
  return json({
    found: out?.found === true && grade.length > 0,
    grade,
    color: pickColor(out?.hold_color) || pickColor(out?.printed_color),
    name: clean(out?.name, 60),
    setter: clean(out?.setter, 60),
  });
});

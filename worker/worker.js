// Cloudflare Worker: holder Anthropic-nøkkelen skjult og videresender forespørsler fra Overland Norden.
// Variabler (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  (Secret)  nøkkelen fra console.anthropic.com
//   APP_TOKEN          (Secret)  en kode du velger selv, skrives inn i appen
//   ALLOWED_ORIGIN     (Text)    https://seriksso-maker.github.io

const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];

export default {
  async fetch(req, env) {
    const allow = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Headers': 'content-type,x-app-token',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Vary': 'Origin',
    };
    const json = (obj, status) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: { message: 'Bruk POST' } }, 405);
    if (allow !== '*' && req.headers.get('Origin') !== allow) return json({ error: { message: 'Ikke tillatt opprinnelse' } }, 403);
    if (!env.ANTHROPIC_API_KEY) return json({ error: { message: 'Worker mangler ANTHROPIC_API_KEY' } }, 500);
    if (env.APP_TOKEN && req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: { message: 'Feil tilgangskode' } }, 401);

    let b;
    try { b = await req.json(); } catch (e) { return json({ error: { message: 'Ugyldig forespørsel' } }, 400); }

    const payload = {
      model: MODELS.includes(b.model) ? b.model : MODELS[0],
      max_tokens: Math.min(+b.max_tokens || 1500, 2000),
      system: String(b.system || '').slice(0, 12000),
      messages: (Array.isArray(b.messages) ? b.messages : []).slice(0, 4).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 40000),
      })),
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};

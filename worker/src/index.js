// Комора sync: one JSON document per household, addressed by a random 26-char code.
// GET  /h/:code                    -> {version, data} | 404
// PUT  /h/:code {version, data}    -> {version}; version 0 creates. Stale version -> 409 {version, data}

const CODE = /^[a-z2-7]{26}$/;
const MAX_BODY = 512 * 1024;

function cors(request, env) {
  let origin = request.headers.get('Origin') || '';
  let allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

async function current(env, code) {
  let row = await env.DB.prepare('SELECT version, data FROM households WHERE id = ?').bind(code).first();
  return row ? { version: row.version, data: JSON.parse(row.data) } : null;
}

function validData(d) {
  return d && typeof d === 'object' && Array.isArray(d.items) && Array.isArray(d.shop) &&
    d.catalog && typeof d.catalog === 'object' && d.deleted && typeof d.deleted === 'object';
}

export default {
  async fetch(request, env) {
    let h = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    let m = new URL(request.url).pathname.match(/^\/h\/([^/]+)$/);
    if (!m || !CODE.test(m[1])) return json({ error: 'not found' }, 404, h);
    let code = m[1];

    if (request.method === 'GET') {
      let doc = await current(env, code);
      return doc ? json(doc, 200, h) : json({ error: 'not found' }, 404, h);
    }

    if (request.method !== 'PUT') return json({ error: 'method' }, 405, h);

    let text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'too large' }, 413, h);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400, h); }
    if (!Number.isInteger(body?.version) || body.version < 0 || !validData(body.data)) {
      return json({ error: 'bad request' }, 400, h);
    }

    let data = JSON.stringify(body.data), now = Date.now(), res;
    if (body.version === 0) {
      res = await env.DB.prepare('INSERT OR IGNORE INTO households (id, version, data, updated_at) VALUES (?, 1, ?, ?)')
        .bind(code, data, now).run();
    } else {
      res = await env.DB.prepare('UPDATE households SET version = version + 1, data = ?, updated_at = ? WHERE id = ? AND version = ?')
        .bind(data, now, code, body.version).run();
    }
    if (res.meta.changes === 1) return json({ version: body.version + 1 }, 200, h);

    let doc = await current(env, code);
    return doc ? json(doc, 409, h) : json({ error: 'not found' }, 404, h);
  },
};

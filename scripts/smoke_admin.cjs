const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function parseEnvDotLocal(filePath) {
  const out = {};
  const txt = fs.readFileSync(filePath, 'utf8');
  for (const ln of txt.split(/\r?\n/)) {
    if (!ln || ln.trim().startsWith('#')) continue;
    const i = ln.indexOf('=');
    if (i <= 0) continue;
    const k = ln.slice(0, i);
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, ok: r.ok, text, json };
}

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  const env = parseEnvDotLocal(envPath);

  const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminToken = env.ADMIN_UPLOAD_TOKEN;
  const bucket = env.S3_BUCKET;
  if (!supaUrl || !service || !adminToken || !bucket) {
    throw new Error('Missing required envs (SUPABASE URL/SERVICE, ADMIN_UPLOAD_TOKEN, S3_BUCKET)');
  }

  // 1) Admin page should be accessible with cookie
  const adminPage = await fetch(base + '/admin/templates1', { headers: { Cookie: 'admin-token=' + adminToken } });
  const adminHtml = await adminPage.text();
  console.log('GET /admin/templates1 =>', adminPage.status, /Admin Templates/.test(adminHtml) ? 'OK' : 'Unexpected');

  // 2) Insert a draft template via Supabase REST (avoid schema drift on category_id)
  const id = randomUUID();
  const headers = {
    'apikey': service,
    'Authorization': 'Bearer ' + service,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  const insBody = {
    id,
    title: 'Smoke Draft ' + Date.now(),
    category: 'Smoke',
    background_prompt: 'bg prompt',
    product_prompt: 'prod prompt',
    status: 'draft',
    featured: false,
  };
  const insert = await fetchJson(supaUrl + '/rest/v1/templates', { method: 'POST', headers, body: JSON.stringify(insBody) });
  console.log('REST insert template =>', insert.status, insert.text.slice(0, 120));
  if (!insert.ok) process.exit(1);

  // 3) Upload background and preview via API routes
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2X9zgAAAAASUVORK5CYII=';
  const upBg = await fetchJson(base + '/api/admin/templates/upload-background', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ templateId: id, dataUrl: png, mimeType: 'image/png' }),
  });
  console.log('upload-background =>', upBg.status, upBg.text.slice(0, 200));
  const upPrev = await fetchJson(base + '/api/admin/templates/upload-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ templateId: id, dataUrl: png, mimeType: 'image/png' }),
  });
  console.log('upload-preview =>', upPrev.status, upPrev.text.slice(0, 200));

  // 4) Publish via Supabase REST (server action publish is not directly invocable)
  const publish = await fetchJson(supaUrl + '/rest/v1/templates?id=eq.' + id, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'published' }),
  });
  console.log('publish via REST =>', publish.status, publish.text.slice(0, 120));

  // 5) Public list should include at least one item
  const list = await fetchJson(base + '/api/templates');
  console.log('GET /api/templates =>', list.status, list.text.slice(0, 200));
})();

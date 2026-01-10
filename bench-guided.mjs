import fs from 'fs';

function parseEnvFile(path) {
  const txt = fs.readFileSync(path, 'utf8');
  const env = {};
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, '').trim();
    env[m[1]] = v;
  }
  return env;
}

async function loginSupabase(env) {
  const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TEST_EMAIL || 'jamesbond2095@gmail.com';
  const password = process.env.TEST_PASSWORD || 'James25bond2095';
  const tokenUrl = SUPA_URL.replace(/\/$/, '') + '/auth/v1/token?grant_type=password';
  const authRes = await fetch(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'apikey': SUPA_ANON, accept: 'application/json' }, body: JSON.stringify({ email, password }) });
  const authTxt = await authRes.text();
  if (!authRes.ok) throw new Error(`supabase login failed ${authRes.status} ${authTxt.slice(0,200)}`);
  const auth = JSON.parse(authTxt);
  const ref = (SUPA_URL.match(/https?:\/\/([^.]+)\./) || [null, ''])[1];
  const cookieName = `sb-${ref}-auth-token`;
  const cookieVal = encodeURIComponent(JSON.stringify({ access_token: auth.access_token, refresh_token: auth.refresh_token, expires_at: Math.floor(Date.now()/1000) + (auth.expires_in||3600), token_type: 'bearer', user: auth.user || null }));
  return `${cookieName}=${cookieVal}; Path=/; HttpOnly; SameSite=Lax`;
}

const env = parseEnvFile('.env.local');
const cookie = await loginSupabase(env);
const base = 'http://localhost:3006';
const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

const t0 = Date.now();
const res = await fetch(base + '/api/generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cookie': cookie },
  body: JSON.stringify({ prompt: 'studio product, soft light, single subject', aspectRatio: '1:1', numImages: 1, persist: false, productImageDataUrl: png1x1, keepBackground: true })
});
const dt = Date.now() - t0;
const txt = await res.text();
console.log('guided generate status', res.status, 'time', dt+'ms');
try {
  const j = JSON.parse(txt);
  console.log('has images?', Array.isArray(j.images) && j.images.length>0, 'debug?', !!j.debug);
  if (j.debug) console.log('debug.endpoint', j.debug.endpoint, 'request.model', j.debug?.request?.model || 'n/a');
} catch {
  console.log('body_head', txt.slice(0,300));
}

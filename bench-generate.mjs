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
    // Strip surrounding quotes if present twice or once
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, '').trim();
    env[m[1]] = v;
  }
  return env;
}

const env = parseEnvFile('.env.local');
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_ANON) {
  console.error('Missing supabase envs');
  process.exit(1);
}
const email = process.env.TEST_EMAIL || 'jamesbond2095@gmail.com';
const password = process.env.TEST_PASSWORD || 'James25bond2095';

const tokenUrl = SUPA_URL.replace(/\/$/, '') + '/auth/v1/token?grant_type=password';
const authRes = await fetch(tokenUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'apikey': SUPA_ANON, accept: 'application/json' },
  body: JSON.stringify({ email, password })
});
const authTxt = await authRes.text();
if (!authRes.ok) {
  console.error('supabase login failed', authRes.status, authTxt.slice(0, 300));
  process.exit(1);
}
const auth = JSON.parse(authTxt);
const access = auth.access_token;
const refresh = auth.refresh_token;
const expires_in = auth.expires_in || 3600;
const expires_at = Math.floor(Date.now() / 1000) + expires_in;
const ref = (SUPA_URL.match(/https?:\/\/([^.]+)\./) || [null, ''])[1];
const cookieName = `sb-${ref}-auth-token`;
const cookieVal = encodeURIComponent(JSON.stringify({ access_token: access, refresh_token: refresh, expires_at, token_type: 'bearer', user: auth.user || null }));
const cookie = `${cookieName}=${cookieVal}; Path=/; HttpOnly; SameSite=Lax`;

const base = process.env.LOCAL_BASE || 'http://localhost:3006';
const t0 = Date.now();
const genRes = await fetch(base + '/api/generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cookie': cookie },
  body: JSON.stringify({ prompt: 'studio product, soft light, single subject', aspectRatio: '1:1', numImages: 1, persist: false })
});
const dt = Date.now() - t0;
const txt = await genRes.text();
console.log('generate status', genRes.status, 'time', dt + 'ms');
console.log('body_head', txt.slice(0, 400));

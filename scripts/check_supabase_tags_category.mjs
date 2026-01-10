import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

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
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  const env = parseEnvDotLocal(envPath);
  const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !service) throw new Error('Missing SUPABASE URL/SERVICE envs');

  const headers = {
    'apikey': service,
    'Authorization': 'Bearer ' + service,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  const id = randomUUID();
  console.log('Inserting draft template', id);
  const insBody = {
    id,
    title: 'QA Template ' + Date.now(),
    category: 'QA1',
    status: 'draft',
    featured: false,
  };
  const insert = await fetchJson(`${supaUrl}/rest/v1/templates`, { method: 'POST', headers, body: JSON.stringify(insBody) });
  console.log('Insert =>', insert.status, insert.text.slice(0, 140));
  if (!insert.ok) process.exit(1);

  // Try to set tags on templates.tags first
  const tags = ['qa', 'check'];
  let tagStore = 'templates.tags';
  let up1 = await fetchJson(`${supaUrl}/rest/v1/templates?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ tags }) });
  if (!up1.ok) {
    // Fallback to templates.metadata.tags
    tagStore = 'templates.metadata.tags';
    up1 = await fetchJson(`${supaUrl}/rest/v1/templates?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ metadata: { tags } }) });
  }
  console.log('Update tags =>', up1.status, tagStore);

  // Update category (simulates draft-only edit)
  const up2 = await fetchJson(`${supaUrl}/rest/v1/templates?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ category: 'QA2' }) });
  console.log('Update category =>', up2.status);

  // Read back
  const sel = await fetchJson(`${supaUrl}/rest/v1/templates?id=eq.${id}&select=id,category,tags,metadata`);
  console.log('Select =>', sel.status, sel.text.slice(0, 200));

  // Cleanup
  const del = await fetchJson(`${supaUrl}/rest/v1/templates?id=eq.${id}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
  console.log('Cleanup delete =>', del.status);
})();

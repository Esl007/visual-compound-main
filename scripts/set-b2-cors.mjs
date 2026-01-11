#!/usr/bin/env node
import fs from 'fs/promises';

async function readEnv() {
  const p = new URL('../.env.local', import.meta.url);
  const raw = await fs.readFile(p, 'utf8');
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });
  return env;
}

async function b2Authorize(keyId, appKey) {
  const basic = Buffer.from(`${keyId}:${appKey}`).toString('base64');
  const r = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', { headers: { Authorization: `Basic ${basic}` } });
  if (!r.ok) throw new Error(`b2_authorize_account failed: ${r.status}`);
  return await r.json();
}

async function b2ListBuckets(apiUrl, authToken, accountId, bucketName) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_list_buckets`, {
    method: 'POST',
    headers: { Authorization: authToken, 'content-type': 'application/json' },
    body: JSON.stringify({ accountId, bucketName })
  });
  if (!r.ok) throw new Error(`b2_list_buckets failed: ${r.status}`);
  return await r.json();
}

async function b2UpdateBucket(apiUrl, authToken, bucketId, corsRules) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_update_bucket`, {
    method: 'POST',
    headers: { Authorization: authToken, 'content-type': 'application/json' },
    body: JSON.stringify({ bucketId, corsRules })
  });
  if (!r.ok) throw new Error(`b2_update_bucket failed: ${r.status}`);
  return await r.json();
}

(async () => {
  const env = await readEnv();
  const keyId = env.S3_ACCESS_KEY_ID;
  const appKey = env.S3_SECRET_ACCESS_KEY;
  const bucketName = env.S3_BUCKET;
  if (!keyId || !appKey || !bucketName) {
    console.error('Missing S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, or S3_BUCKET in .env.local');
    process.exit(1);
  }

  const origins = Array.from(new Set([
    '*',
    'https://vizualyai.com',
    'https://www.vizualyai.com',
    'https://visual-compound-main.vercel.app',
    'http://localhost:3000',
  ]));

  const { apiUrl, authorizationToken, accountId } = await b2Authorize(keyId, appKey);
  const buckets = await b2ListBuckets(apiUrl, authorizationToken, accountId, bucketName);
  const b = (buckets.buckets || []).find(x => x.bucketName === bucketName);
  if (!b) throw new Error(`Bucket not found: ${bucketName}`);

  const corsRules = [
    {
      corsRuleName: 'public-wildcard',
      allowedOrigins: origins,
      allowedHeaders: [
        '*', 'Authorization', 'Content-Type', 'x-amz-*', 'x-amz-meta-*', 'x-amz-sdk-checksum-algorithm', 'x-amz-checksum-crc32'
      ],
      allowedOperations: [
        'b2_upload_file',
        'b2_download_file_by_id',
        'b2_download_file_by_name',
        's3_get', 's3_put', 's3_head', 's3_post'
      ],
      exposeHeaders: ['ETag', 'x-bz-file-id', 'x-bz-file-name', 'x-bz-content-sha1'],
      maxAgeSeconds: 86400,
    }
  ];

  const res = await b2UpdateBucket(apiUrl, authorizationToken, b.bucketId, corsRules);
  console.log(JSON.stringify({ ok: true, bucketId: b.bucketId, appliedOrigins: origins, rules: res.corsRules }, null, 2));
})();

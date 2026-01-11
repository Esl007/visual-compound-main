#!/usr/bin/env node
import fs from 'fs/promises';
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

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

(async () => {
  const env = await readEnv();
  const bucket = env.S3_BUCKET;
  const region = env.S3_REGION || 'us-east-005';
  const endpoint = env.S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
  const forcePathStyle = String(env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false';
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    console.error('Missing S3_BUCKET or credentials in .env.local');
    process.exit(1);
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  const origins = Array.from(new Set([
    '*',
    'https://vizualyai.com',
    'https://www.vizualyai.com',
    'https://visual-compound-main.vercel.app',
    'http://localhost:3000',
  ]));

  const rule = {
    AllowedMethods: ['GET', 'PUT', 'HEAD', 'POST'],
    AllowedOrigins: origins,
    AllowedHeaders: [
      '*',
      'Authorization',
      'Content-Type',
      'x-amz-*',
      'x-amz-meta-*',
      'x-amz-sdk-checksum-algorithm',
      'x-amz-checksum-crc32',
    ],
    ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
    MaxAgeSeconds: 86400,
  };

  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log('Current S3 CORS:', JSON.stringify(current.CORSRules || [], null, 2));
  } catch (e) {
    console.log('No existing S3 CORS or failed to fetch:', (e && e.message) || String(e));
  }

  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: [rule] } }));
  console.log('Applied S3 CORS rule for bucket', bucket, 'with origins', origins);
})();

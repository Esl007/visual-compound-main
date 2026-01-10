import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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

(async () => {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  const env = parseEnvDotLocal(envPath);
  const bucket = env.S3_BUCKET;
  const endpoint = env.S3_ENDPOINT;
  const region = env.S3_REGION || 'us-east-005';
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing S3 envs (S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)');
  }

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const id = randomUUID();
  const base = `users/admin-templates/${id}`;
  const key = `${base}/original-${id}.png`;
  const body = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2X9zgAAAAASUVORK5CYII=', 'base64');

  console.log('Uploading test object to', bucket, key);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/png', CacheControl: 'public, max-age=31536000, immutable' }));

  const tryGet = async () => {
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: 'bytes=0-0' }));
      return r.ContentRange || 'ok';
    } catch (e) {
      return e.$metadata?.httpStatusCode || e.name || 'error';
    }
  };

  const existsBefore = await tryGet();
  console.log('Exists before delete =>', existsBefore);

  console.log('Deleting test object');
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  const existsAfter = await tryGet();
  console.log('Exists after delete =>', existsAfter);

  if (String(existsBefore).includes('bytes') && (existsAfter === 404 || existsAfter === 'NotFound' || existsAfter === 'error')) {
    console.log('Backblaze upload+delete check: PASS');
    process.exit(0);
  } else {
    console.error('Backblaze upload+delete check: FAIL');
    process.exit(2);
  }
})();

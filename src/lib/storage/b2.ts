import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, GetBucketCorsCommand, PutBucketCorsCommand, CORSRule } from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";

function truthy(v: any) {
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return Boolean(v);
}

// Ensure B2 bucket has permissive CORS for browser-based presigned PUTs.
// Allowed origins can be specific domains; default to '*'.
export async function ensureBucketCors(bucket: string, allowedOrigins: string[] = ["*"]) {
  const client = b2Client();
  let existingOrigins: string[] = [];
  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    const rules = current.CORSRules || [];
    existingOrigins = Array.from(
      new Set(
        rules.flatMap((r) => (r.AllowedOrigins || [])).map((o) => o.trim()).filter(Boolean)
      )
    );
    // Check if there is at least one rule that allows PUT/GET/HEAD from any of the allowed origins
    const hasRule = rules.some((r) => {
      const methods = new Set((r.AllowedMethods || []).map((m) => m.toUpperCase()));
      const origins = new Set((r.AllowedOrigins || []).map((o) => o.toLowerCase()));
      const methodOk = methods.has("PUT") && methods.has("GET") && methods.has("HEAD");
      const originOk = allowedOrigins.some((o) => origins.has(o.toLowerCase()) || origins.has("*"));
      return methodOk && originOk;
    });
    if (hasRule) return;
  } catch (_) {
    // Missing CORS config; proceed to set it.
  }
  const finalOrigins = Array.from(new Set(["*", ...existingOrigins, ...allowedOrigins]));
  const rule: CORSRule = {
    AllowedMethods: ["GET", "PUT", "HEAD", "POST"],
    AllowedOrigins: finalOrigins,
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
    MaxAgeSeconds: 3000,
  };
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: [rule] } }));
}

export function b2Client() {
  const region = process.env.S3_REGION || "us-east-005";
  const endpoint = process.env.S3_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
  const forcePathStyle = truthy(process.env.S3_FORCE_PATH_STYLE ?? true);
  const accessKeyId = process.env.S3_ACCESS_KEY_ID as string;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY as string;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY");
  }
  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadImage(params: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const client = b2Client();
  const cmd = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    CacheControl: params.cacheControl,
  });
  try {
    await client.send(cmd);
  } catch (e: any) {
    const name = e?.name || e?.code || "UploadError";
    const msg = e?.message || String(e);
    const extra = e?.$metadata ? ` status=${e.$metadata.httpStatusCode}` : "";
    throw new Error(`PutObject failed bucket=${params.bucket} key=${params.key} ${name}${extra}: ${msg}`);
  }
}

export async function deleteImage(params: { bucket: string; key: string }) {
  const client = b2Client();
  const cmd = new DeleteObjectCommand({ Bucket: params.bucket, Key: params.key });
  await client.send(cmd);
}

export async function getSignedUrl(params: { bucket: string; key: string; expiresInSeconds?: number }) {
  const client = b2Client();
  const cmd = new GetObjectCommand({ Bucket: params.bucket, Key: params.key });
  const url = await presign(client, cmd, { expiresIn: params.expiresInSeconds ?? 300 });
  return url;
}

export async function getSignedPutUrl(params: { bucket: string; key: string; contentType?: string; expiresInSeconds?: number }) {
  const client = b2Client();
  const cmd = new PutObjectCommand({ Bucket: params.bucket, Key: params.key, ContentType: params.contentType });
  const url = await presign(client, cmd, { expiresIn: params.expiresInSeconds ?? 600 });
  return url;
}

export function cacheControlForKey(key: string) {
  if (key.startsWith("templates/")) return "public, max-age=31536000, immutable";
  // Long-lived CDN caching for user images. Objects are immutable by id, so safe to cache long on CDN.
  if (key.startsWith("users/")) return "public, max-age=31536000, immutable";
  return undefined;
}

// Lightweight existence probe using a presigned GET URL and a HEAD request
export async function headObjectUrlIfExists(bucket: string, key: string, timeoutMs: number = 2500): Promise<string | null> {
  try {
    const url = await getSignedUrl({ bucket, key, expiresInSeconds: 180 });
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      // Some S3-compatible providers do not honor HEAD with presigned GET URLs.
      // Use a ranged GET to fetch 1 byte as a lightweight existence check.
      const r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: ac.signal } as any);
      if (r.ok || r.status === 206) return url;
    } finally {
      clearTimeout(t);
    }
  } catch {}
  return null;
}

export async function uploadImageWithVerify(
  params: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl?: string;
  },
  opts?: { verify?: boolean; maxVerifyMs?: number }
) {
  await uploadImage(params);
  if (opts?.verify === false) return;
  const deadline = Date.now() + (opts?.maxVerifyMs ?? 4000);
  // 2 quick probes with short waits, then give up (still succeed, but caller may choose to warn)
  let lastUrl: string | null = null;
  while (Date.now() < deadline) {
    lastUrl = await headObjectUrlIfExists(params.bucket, params.key, 1500);
    if (lastUrl) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  // If we get here, upload succeeded but object not yet retrievable
  throw new Error(`Uploaded but not yet retrievable bucket=${params.bucket} key=${params.key}`);
}

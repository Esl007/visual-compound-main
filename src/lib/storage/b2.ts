import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";

function truthy(v: any) {
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return Boolean(v);
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
  await client.send(cmd);
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

export function cacheControlForKey(key: string) {
  if (key.startsWith("templates/")) return "public, max-age=31536000, immutable";
  // Long-lived CDN caching for user images. Objects are immutable by id, so safe to cache long on CDN.
  if (key.startsWith("users/")) return "public, max-age=31536000, immutable";
  return undefined;
}

import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function cleanEnv(v?: string) {
  if (!v) return v as any;
  let out = v.trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  return out;
}

function required(name: string, v?: string) {
  const cleaned = cleanEnv(v);
  if (!cleaned) throw new Error(`Missing env ${name}`);
  return cleaned as string;
}

function parseBucketKeyFromUrl(url: string) {
  try {
    // path-style: https://host/bucket/key
    const m1 = url.match(/^https?:\/\/[^/]+\/([^/]+)\/(.+)$/);
    if (m1) return { bucket: m1[1], key: m1[2] };
    // virtual-hosted-style: https://bucket.host/key
    const m2 = url.match(/^https?:\/\/([^\.]+)\.[^/]+\/(.+)$/);
    if (m2) return { bucket: m2[1], key: m2[2] };
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url, bucket: bodyBucket, key: bodyKey, expiresIn }: { url?: string; bucket?: string; key?: string; expiresIn?: number } = await req.json();

    const defaultBucket = required("S3_BUCKET", process.env.S3_BUCKET);
    const region = required("S3_REGION", process.env.S3_REGION);
    const accessKeyId = required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = required("S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY);
    const endpoint = required("S3_ENDPOINT", process.env.S3_ENDPOINT);
    const forcePathStyle = cleanEnv(process.env.S3_FORCE_PATH_STYLE)?.toLowerCase() !== "false";

    let bucket = cleanEnv(bodyBucket);
    let key = cleanEnv(bodyKey);

    if ((!bucket || !key) && url) {
      const parsed = parseBucketKeyFromUrl(url);
      if (parsed) {
        bucket = parsed.bucket;
        key = parsed.key;
      }
    }

    if (!bucket || !key) return new Response("Missing bucket/key or url", { status: 400 });

    const allowedBuckets = new Set([defaultBucket, "AI-Image-Gen-3"]);
    if (!allowedBuckets.has(bucket)) return new Response("Bucket not allowed", { status: 400 });

    const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, endpoint, forcePathStyle });

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const seconds = Math.max(30, Math.min(60 * 10, Number(expiresIn) || 60 * 5));
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: seconds });

    return new Response(JSON.stringify({ signedUrl }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function cleanEnv(v?: string) {
  if (!v) return v;
  let out = v.trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  return out;
}

function required(name: string, v?: string) {
  const cleaned = cleanEnv(v);
  if (!cleaned) throw new Error(`Missing env ${name}`);
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestedBucket = cleanEnv(body?.bucket);
    const prefix = (cleanEnv(body?.prefix) || "generated").replace(/(^\/+|\/+?$)/g, "");

    const defaultBucket = required("S3_BUCKET", process.env.S3_BUCKET);
    const allowedBuckets = new Set([defaultBucket, "AI-Image-Gen-3"]);
    const bucket = requestedBucket && allowedBuckets.has(requestedBucket) ? requestedBucket : defaultBucket;

    const region = required("S3_REGION", process.env.S3_REGION);
    const accessKeyId = required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = required("S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY);
    const endpoint = required("S3_ENDPOINT", process.env.S3_ENDPOINT);
    const forcePathStyle = cleanEnv(process.env.S3_FORCE_PATH_STYLE)?.toLowerCase() !== "false";

    const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, endpoint, forcePathStyle });

    const key = `${prefix}/health-${Date.now()}.txt`;
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from("ok"), ContentType: "text/plain" });
    const result = await s3.send(cmd);

    const normalizedEndpoint = endpoint.replace(/\/$/, "");
    const fileUrl = forcePathStyle
      ? `${normalizedEndpoint}/${bucket}/${key}`
      : `${normalizedEndpoint}/${bucket}/${key}`;

    return new Response(JSON.stringify({ ok: true, bucket, key, etag: result.ETag || null, fileUrl }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = e?.$metadata?.httpStatusCode || 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: typeof code === "number" ? code : 500,
      headers: { "content-type": "application/json" },
    });
  }
}

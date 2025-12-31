import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function cleanEnv(val?: string | null) {
  if (!val) return undefined;
  const s = String(val).trim();
  return s.length ? s : undefined;
}

function required(name: string, val?: string | null) {
  const v = cleanEnv(val);
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function buildPublicUrl(endpoint: string, bucket: string, key: string, forcePathStyle: boolean) {
  const normalizedEndpoint = endpoint.replace(/\/$/, "");
  if (forcePathStyle) {
    return `${normalizedEndpoint}/${bucket}/${key}`;
  }
  const m = normalizedEndpoint.match(/^(https?:)\/\/([^/]+)(.*)$/);
  if (m) {
    const proto = m[1];
    const host = m[2];
    const rest = m[3] || "";
    return `${proto}//${bucket}.${host}${rest}/${key}`;
  }
  return `${normalizedEndpoint}/${bucket}/${key}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dataUrl: string | undefined = cleanEnv(body?.dataUrl);
    const requestedBucket: string | undefined = cleanEnv(body?.bucket);
    const prefix: string | undefined = cleanEnv(body?.prefix);
    const overrideContentType: string | undefined = cleanEnv(body?.contentType);

    if (!dataUrl || !/^data:[^;]+;base64,/i.test(dataUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid dataUrl; must be data:*;base64,..." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const defaultBucket = required("S3_BUCKET", process.env.S3_BUCKET);
    const cleanedRequestedBucket = cleanEnv(requestedBucket);
    const allowedBuckets = new Set([defaultBucket, "AI-Image-Gen-3"]);
    const bucket = cleanedRequestedBucket && allowedBuckets.has(cleanedRequestedBucket)
      ? cleanedRequestedBucket
      : defaultBucket;

    const region = required("S3_REGION", process.env.S3_REGION);
    const accessKeyId = required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = required("S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY);
    const endpoint = required("S3_ENDPOINT", process.env.S3_ENDPOINT);
    const forcePathStyle = cleanEnv(process.env.S3_FORCE_PATH_STYLE)?.toLowerCase() !== "false";

    // parse data URL
    const match = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
    const contentType = overrideContentType || match?.[1] || "application/octet-stream";
    const base64 = match?.[2] || "";
    const buffer = Buffer.from(base64, "base64");

    // Build object key
    const safePrefix = (prefix || "uploads").replace(/(^\/+|\/+?$)/g, "");
    const ext = (contentType.split("/").pop() || "bin").toLowerCase();
    const key = `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      forcePathStyle,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3.send(command);

    const fileUrl = buildPublicUrl(endpoint, bucket, key, forcePathStyle);

    return new Response(
      JSON.stringify({ key, fileUrl }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Upload failed" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

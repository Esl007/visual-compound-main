import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    const {
      contentType,
      fileName,
      bucket: requestedBucket,
      prefix,
    }: { contentType?: string; fileName?: string; bucket?: string; prefix?: string } = await req.json();

    const defaultBucket = required("S3_BUCKET", process.env.S3_BUCKET);
    const cleanedRequestedBucket = cleanEnv(requestedBucket);
    // Only allow overriding to the default bucket or the explicitly permitted production bucket
    const allowedBuckets = new Set([defaultBucket, "AI-Image-Gen-3"]);
    const bucket = cleanedRequestedBucket && allowedBuckets.has(cleanedRequestedBucket)
      ? cleanedRequestedBucket
      : defaultBucket;
    const region = required("S3_REGION", process.env.S3_REGION);
    const accessKeyId = required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = required("S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY);
    const endpoint = required("S3_ENDPOINT", process.env.S3_ENDPOINT);
    const forcePathStyle = cleanEnv(process.env.S3_FORCE_PATH_STYLE)?.toLowerCase() !== "false";

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      forcePathStyle,
    });

    // Generate key
    const safePrefix = (prefix || "uploads").replace(/(^\/+|\/+?$)/g, "");
    const ext = (fileName || "").split(".").pop();
    const key = `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    // Compute file URL robustly without URL parsing to tolerate minor formatting
    const normalizedEndpoint = endpoint.replace(/\/$/, "");
    let fileUrl: string;
    if (forcePathStyle) {
      fileUrl = `${normalizedEndpoint}/${bucket}/${key}`;
    } else {
      // Best-effort: insert bucket as subdomain
      const m = normalizedEndpoint.match(/^(https?:)\/\/([^/]+)(.*)$/);
      if (m) {
        const proto = m[1];
        const host = m[2];
        const rest = m[3] || "";
        fileUrl = `${proto}//${bucket}.${host}${rest}/${key}`;
      } else {
        fileUrl = `${normalizedEndpoint}/${bucket}/${key}`;
      }
    }

    return new Response(
      JSON.stringify({ uploadUrl, key, fileUrl }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

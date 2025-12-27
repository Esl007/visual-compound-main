import { NextRequest } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string, v?: string) {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const {
      contentType,
      fileName,
    }: { contentType?: string; fileName?: string } = await req.json();

    const bucket = required("S3_BUCKET", process.env.S3_BUCKET);
    const region = required("S3_REGION", process.env.S3_REGION);
    const accessKeyId = required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = required("S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY);
    const endpoint = required("S3_ENDPOINT", process.env.S3_ENDPOINT);
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "true").toLowerCase() === "true";

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      forcePathStyle,
    });

    // Generate key
    const ext = (fileName || "").split(".").pop();
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    let fileUrl: string;
    const u = new URL(endpoint);
    if (forcePathStyle) {
      fileUrl = `${u.origin}/${bucket}/${key}`;
    } else {
      fileUrl = `${u.protocol}//${bucket}.${u.host}/${key}`;
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

import { NextRequest } from "next/server";
import { b2Client } from "@/lib/storage/b2";
import { GetBucketCorsCommand, PutBucketCorsCommand, CORSRule } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

function auth(req: NextRequest) {
  const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
  if (!adminToken) return { ok: false, code: 500, msg: "Missing ADMIN_UPLOAD_TOKEN" } as const;
  const headerToken = req.headers.get("x-admin-token");
  const cookieToken = req.cookies.get("admin-token")?.value;
  if (headerToken !== adminToken && cookieToken !== adminToken) return { ok: false, code: 403, msg: "Forbidden" } as const;
  return { ok: true } as const;
}

export async function GET() {
  try {
    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });
    const client = b2Client();
    const res = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return new Response(JSON.stringify({ bucket, cors: res.CORSRules || [] }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = auth(req);
    if (!a.ok) return new Response(JSON.stringify({ error: a.msg }), { status: a.code });
    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const body = await req.json().catch(() => ({}));
    const origins: string[] = Array.isArray(body?.origins) && body.origins.length ? body.origins.map((o: string) => o.trim()).filter(Boolean) : [];
    const finalOrigins = Array.from(new Set(["*", ...origins]));

    const rule: CORSRule = {
      AllowedMethods: ["GET", "PUT", "HEAD", "POST"],
      AllowedOrigins: finalOrigins,
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
      MaxAgeSeconds: 3000,
    };

    const client = b2Client();
    await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: [rule] } }));
    return new Response(JSON.stringify({ ok: true, bucket, rule }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

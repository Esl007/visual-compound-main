import { NextRequest } from "next/server";
import { ensureBucketCorsNative, getB2NativeUploadUrl } from "@/lib/storage/b2";
import { buildAdminTemplateAssetPaths } from "@/lib/images/paths";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    const cookieToken = req.cookies.get("admin-token")?.value;
    if (headerToken !== adminToken && cookieToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const { templateId, kind } = await req.json();
    if (!templateId || !kind) return new Response(JSON.stringify({ error: "Missing templateId or kind" }), { status: 400 });

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const paths = buildAdminTemplateAssetPaths(String(templateId));
    let key = "";
    if (kind === "background") key = paths.original;
    else if (kind === "product") key = paths.preview;
    else return new Response(JSON.stringify({ error: "Invalid kind" }), { status: 400 });

    const reqOrigin = req.headers.get("origin") || undefined;
    const knownOrigins = [
      reqOrigin,
      process.env.NEXT_PUBLIC_SITE_URL,
      "https://visual-compound-main.vercel.app",
      "https://vizualyai.com",
      "https://www.vizualyai.com",
      "http://localhost:3000",
    ].filter(Boolean) as string[];

    let corsNative: any = null;
    try { corsNative = await ensureBucketCorsNative(bucket, knownOrigins.length ? knownOrigins : ["*"]); } catch (e: any) { corsNative = { error: e?.message || String(e) }; }

    const { uploadUrl, authToken } = await getB2NativeUploadUrl(bucket);
    return new Response(JSON.stringify({ uploadUrl, authToken, key, corsInfo: { b2Native: corsNative } }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

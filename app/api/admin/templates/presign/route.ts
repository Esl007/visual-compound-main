import { NextRequest } from "next/server";
import { getSignedPutUrl, ensureBucketCors } from "@/lib/storage/b2";
import { buildAdminTemplateAssetPaths } from "@/lib/images/paths";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    const cookieToken = req.cookies.get("admin-token")?.value;
    if (headerToken !== adminToken && cookieToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const { templateId, kind, mimeType } = await req.json();
    if (!templateId || !kind) return new Response(JSON.stringify({ error: "Missing templateId or kind" }), { status: 400 });

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const paths = buildAdminTemplateAssetPaths(String(templateId));
    let key = "";
    if (kind === "background") key = paths.original;
    else if (kind === "product") key = paths.preview; // stage product to preview key, will be processed
    else return new Response(JSON.stringify({ error: "Invalid kind" }), { status: 400 });

    // Ensure permissive CORS so browser PUT works cross-origin
    try { await ensureBucketCors(bucket, ["*"]); } catch {}
    const putUrl = await getSignedPutUrl({ bucket, key, contentType: String(mimeType || "application/octet-stream") });
    return new Response(JSON.stringify({ putUrl, key }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

import { NextRequest } from "next/server";
import { headObjectUrlIfExists } from "@/lib/storage/b2";
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
    const key = kind === "background" ? paths.original : kind === "product" ? paths.preview : "";
    if (!key) return new Response(JSON.stringify({ error: "Invalid kind" }), { status: 400 });

    const url = await headObjectUrlIfExists(bucket, key, 1500);
    const exists = !!url;
    return new Response(JSON.stringify({ exists, key, url: url || null }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

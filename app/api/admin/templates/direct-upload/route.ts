import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadImage, cacheControlForKey } from "@/lib/storage/b2";
import { buildAdminTemplateAssetPaths } from "@/lib/images/paths";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    const cookieToken = req.cookies.get("admin-token")?.value;
    if (headerToken !== adminToken && cookieToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const form = await req.formData();
    const id = String(form.get("id") || "");
    const kind = String(form.get("kind") || "");
    const file = form.get("file") as unknown as File | null;
    if (!id || !kind || !file) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const buf = Buffer.from(await (file as File).arrayBuffer());
    const paths = buildAdminTemplateAssetPaths(id);
    const key = kind === "background" ? paths.original : paths.preview;

    await uploadImage({ bucket, key, body: buf, contentType: (file as File).type || "application/octet-stream", cacheControl: cacheControlForKey(key) });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

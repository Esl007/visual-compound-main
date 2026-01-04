import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadImageWithVerify, cacheControlForKey } from "@/lib/storage/b2";
import { buildTemplateAssetPaths } from "@/lib/images/paths";
import { reencodeToPng } from "@/lib/images/thumbs";

export const runtime = "nodejs";

function parseDataInput(body: any): { buffer: Buffer; mime: string } {
  const dataUrl: string | undefined = body?.dataUrl;
  const imageBase64: string | undefined = body?.imageBase64;
  const mimeType: string | undefined = body?.mimeType;
  if (dataUrl) {
    const m = /^data:([^;,]+);base64,(.*)$/i.exec(dataUrl || "");
    if (!m) throw new Error("Invalid data URL");
    return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
  }
  if (imageBase64) {
    return { buffer: Buffer.from(String(imageBase64), "base64"), mime: mimeType || "image/png" };
  }
  throw new Error("Missing image data");
}

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    const cookieToken = req.cookies.get("admin-token")?.value;
    if (headerToken !== adminToken && cookieToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const supa = supabaseAdmin();
    const body = await req.json();
    const templateId: string | undefined = body?.templateId;
    if (!templateId) return new Response(JSON.stringify({ error: "Missing templateId" }), { status: 400 });

    const { buffer } = parseDataInput(body);
    const png = await reencodeToPng(buffer);

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const paths = buildTemplateAssetPaths(templateId);

    await uploadImageWithVerify({ bucket, key: paths.preview, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });

    // Generate thumbnails from the preview as well to ensure the grid has assets
    let t400: string | null = null;
    let t600: string | null = null;
    try {
      const { generateAndUploadThumbnails } = await import("@/lib/images/thumbs");
      const thumbs = await generateAndUploadThumbnails({ input: png, bucket, outputBasePath: paths.base });
      t400 = thumbs.find((t) => t.size === 400)?.path || null;
      t600 = thumbs.find((t) => t.size === 600)?.path || null;
    } catch {}

    const { error } = await supa
      .from("templates")
      .update({ preview_image_path: paths.preview, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() })
      .eq("id", templateId);
    if (error) throw error;

    return new Response(
      JSON.stringify({ templateId, preview_image_path: paths.preview, thumbnail_400_path: t400, thumbnail_600_path: t600 }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

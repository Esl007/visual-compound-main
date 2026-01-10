import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadImage, cacheControlForKey, getSignedUrl } from "@/lib/storage/b2";
import { buildAdminTemplateAssetPaths } from "@/lib/images/paths";
import { generateAndUploadThumbnails, reencodeToPng } from "@/lib/images/thumbs";
import sharp from "sharp";

export const runtime = "nodejs";

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
    const kind: "background" | "product" | undefined = body?.kind;
    if (!templateId || !kind) return new Response(JSON.stringify({ error: "Missing templateId or kind" }), { status: 400 });

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const paths = buildAdminTemplateAssetPaths(templateId);

    if (kind === "background") {
      // Fetch uploaded object and re-encode to PNG, then generate thumbnails and update DB
      const srcUrl = await getSignedUrl({ bucket, key: paths.original, expiresInSeconds: 180 });
      const r = await fetch(srcUrl);
      if (!r.ok) return new Response(JSON.stringify({ error: `Source not found (${paths.original})` }), { status: 404 });
      const buf = Buffer.from(await r.arrayBuffer());
      const png = await reencodeToPng(buf);
      await uploadImage({ bucket, key: paths.original, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.original) });
      const thumbs = await generateAndUploadThumbnails({ input: png, bucket, outputBasePath: paths.base });
      const t400 = thumbs.find((t) => t.size === 400)?.path || null;
      const t600 = thumbs.find((t) => t.size === 600)?.path || null;
      const { error } = await supa
        .from("templates")
        .update({ background_image_path: paths.original, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, templateId, background_image_path: paths.original, thumbnail_400_path: t400, thumbnail_600_path: t600 }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (kind === "product") {
      // Compose uploaded product (currently at preview key) over background if available
      const prodUrl = await getSignedUrl({ bucket, key: paths.preview, expiresInSeconds: 180 });
      const pr = await fetch(prodUrl);
      if (!pr.ok) return new Response(JSON.stringify({ error: `Product source not found (${paths.preview})` }), { status: 404 });
      const prodBuf = Buffer.from(await pr.arrayBuffer());
      const prodPng = await reencodeToPng(prodBuf);

      const { data: tmpl } = await supa
        .from("templates")
        .select("background_image_path")
        .eq("id", templateId)
        .single();
      const bgKey: string | null = tmpl?.background_image_path || null;

      let composed: Buffer = prodPng;
      if (bgKey) {
        try {
          const bgUrl = await getSignedUrl({ bucket, key: bgKey, expiresInSeconds: 180 });
          const br = await fetch(bgUrl);
          if (br.ok) {
            const bgBuf = Buffer.from(await br.arrayBuffer());
            composed = await sharp(bgBuf).composite([{ input: prodPng }]).png().toBuffer();
          }
        } catch {
          composed = prodPng;
        }
      }

      await uploadImage({ bucket, key: paths.preview, body: composed, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });
      const thumbs = await generateAndUploadThumbnails({ input: composed, bucket, outputBasePath: paths.base });
      const t400 = thumbs.find((t) => t.size === 400)?.path || null;
      const t600 = thumbs.find((t) => t.size === 600)?.path || null;
      const { error } = await supa
        .from("templates")
        .update({ preview_image_path: paths.preview, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, templateId, preview_image_path: paths.preview, thumbnail_400_path: t400, thumbnail_600_path: t600 }), { status: 200, headers: { "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid kind" }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

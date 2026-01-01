import { NextRequest } from "next/server";
import { uploadImage, cacheControlForKey } from "@/lib/storage/b2";
import { buildTemplatePath, extFromMime } from "@/lib/images/paths";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const m = /^data:([^;,]+);base64,(.*)$/i.exec(dataUrl || "");
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const b64 = m[2];
  const buffer = Buffer.from(b64, "base64");
  return { mime, buffer };
}

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    if (headerToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const supa = supabaseAdmin();
    const body = await req.json();
    const category: string | undefined = body?.category;
    const dataUrl: string | undefined = body?.dataUrl;
    const imageBase64: string | undefined = body?.imageBase64;
    const mimeType: string | undefined = body?.mimeType;
    const metadata: any = body?.metadata ?? {};

    if (!category) return new Response(JSON.stringify({ error: "Missing category" }), { status: 400 });

    let mime = mimeType || "image/png";
    let buf: Buffer | null = null;

    if (dataUrl) {
      const p = parseDataUrl(dataUrl);
      mime = p.mime || mime;
      buf = p.buffer;
    } else if (imageBase64) {
      buf = Buffer.from(String(imageBase64), "base64");
    }
    if (!buf) return new Response(JSON.stringify({ error: "Missing image data" }), { status: 400 });

    const ext = extFromMime(mime);
    const { id: templateId, key } = buildTemplatePath(category, undefined, ext);

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    await uploadImage({ bucket, key, body: buf, contentType: mime, cacheControl: cacheControlForKey(key) });

    const { error: dbErr } = await supa.from("images").insert({
      id: templateId,
      user_id: null,
      type: "template",
      storage_path: key,
      metadata,
    });
    if (dbErr) throw dbErr;

    return new Response(JSON.stringify({ id: templateId, storage_path: key, mimeType: mime }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

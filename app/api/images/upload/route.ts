import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { uploadImage, cacheControlForKey, getSignedUrl } from "@/lib/storage/b2";
import { buildUserPath, extFromMime } from "@/lib/images/paths";

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
    const supa = supabaseServer();
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const body = await req.json();
    const imageBase64: string | undefined = body?.imageBase64;
    const mimeType: string | undefined = body?.mimeType;
    const dataUrl: string | undefined = body?.dataUrl; // alternative to imageBase64+mimeType
    const metadata: any = body?.metadata ?? {};

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

    const userId = session.user.id;
    const ext = extFromMime(mime);
    const { id: imageId, key } = buildUserPath(userId, undefined, ext);

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    await uploadImage({ bucket, key, body: buf, contentType: mime, cacheControl: cacheControlForKey(key) });

    const { error: dbErr } = await supa.from("images").insert({
      id: imageId,
      user_id: userId,
      type: "user",
      storage_path: key,
      metadata,
    });
    if (dbErr) throw dbErr;

    const signed_url = await getSignedUrl({ bucket, key, expiresInSeconds: 300 });
    return new Response(JSON.stringify({ id: imageId, storage_path: key, signed_url, mimeType: mime }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

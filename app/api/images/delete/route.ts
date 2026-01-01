import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { deleteImage } from "@/lib/storage/b2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supa = supabaseServer();
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const body = await req.json();
    const imageId: string | undefined = body?.image_id;
    if (!imageId) return new Response(JSON.stringify({ error: "Missing image_id" }), { status: 400 });

    const { data: rows, error } = await supa
      .from("images")
      .select("id, type, storage_path, user_id")
      .eq("id", imageId)
      .limit(1);
    if (error) throw error;
    const row = rows?.[0];
    if (!row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    if (row.type !== "user") {
      return new Response(JSON.stringify({ error: "Cannot delete non-user images here" }), { status: 403 });
    }

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    await deleteImage({ bucket, key: row.storage_path });

    const { error: delErr } = await supa.from("images").delete().eq("id", imageId);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

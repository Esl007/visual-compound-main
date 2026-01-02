import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    if (headerToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const id = params.id;
    if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

    const supa = supabaseAdmin();
    const { data: t, error } = await supa
      .from("templates")
      .select("id, background_image_path, preview_image_path, background_prompt, product_prompt, category_id, category")
      .eq("id", id)
      .single();
    if (error) throw error;

    const hasCategory = !!(t?.category_id || t?.category);
    const hasBG = !!t?.background_image_path;
    const hasPreview = !!t?.preview_image_path;
    const hasPrompts = !!(t?.background_prompt && t?.product_prompt);
    if (!hasCategory || !hasBG || !hasPreview || !hasPrompts) {
      return new Response(JSON.stringify({ error: "Missing required fields to publish" }), { status: 400 });
    }

    const { error: updErr } = await supa
      .from("templates")
      .update({ status: "published", published_at: new Date().toISOString() as any, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updErr) {
      await supa.from("templates").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", id);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

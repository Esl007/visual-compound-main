import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    if (headerToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const supa = supabaseAdmin();
    const body = await req.json();
    const id = randomUUID();
    const title: string = body?.title || "Untitled";
    const category: string = body?.category || "General";
    const background_prompt: string | null = body?.background_prompt ?? null;
    const product_prompt: string | null = body?.product_prompt ?? null;
    const featured: boolean = Boolean(body?.featured);

    const { error } = await supa.from("templates").insert({
      id,
      title,
      category,
      background_prompt,
      product_prompt,
      status: "draft",
      featured,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ id, status: "draft" }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

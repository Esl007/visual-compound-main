import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    const cookieToken = req.cookies.get("admin-token")?.value;
    if (headerToken !== adminToken && cookieToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const supa = supabaseAdmin();
    const url = new URL(req.url);
    const ct = req.headers.get("content-type") || "";
    let body: any = {};
    if (ct.includes("application/json")) {
      body = await req.json();
    } else {
      const fd = await req.formData();
      const toStr = (k: string) => {
        const v = fd.get(k);
        return typeof v === "string" ? v : "";
      };
      body = {
        title: toStr("title") || "Untitled",
        category: toStr("category") || "General",
        category_id: toStr("category_id") || null,
        background_prompt: toStr("background_prompt") || null,
        product_prompt: toStr("product_prompt") || null,
        featured: (toStr("featured") || "false") === "true",
      };
    }
    const id = randomUUID();
    const title: string = body?.title || "Untitled";
    const category: string = body?.category || "General";
    const category_id: string | null = body?.category_id ?? null;
    const background_prompt: string | null = body?.background_prompt ?? null;
    const product_prompt: string | null = body?.product_prompt ?? null;
    const featured: boolean = typeof body?.featured === "string" ? (body.featured === "true") : Boolean(body?.featured);

    let { error } = await supa.from("templates").insert({
      id,
      title,
      category,
      category_id,
      background_prompt,
      product_prompt,
      status: "draft",
      featured,
    } as any);
    if (error) {
      // Fallback for environments without category_id column
      const { error: e2 } = await supa.from("templates").insert({
        id,
        title,
        category,
        background_prompt,
        product_prompt,
        status: "draft",
        featured,
      } as any);
      if (e2) throw e2;
    }

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html") || url.searchParams.get("redirect") === "1") {
      return NextResponse.redirect(new URL("/admin/templates1", req.url), 303);
    }
    return new Response(JSON.stringify({ id, status: "draft" }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    if (headerToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const body = await req.json();
    const email: string = String(body?.email || "").trim().toLowerCase();
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400 });

    const supa = supabaseAdmin();
    const { data, error } = await supa.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;

    return new Response(
      JSON.stringify({ action_link: (data as any)?.action_link || null, email }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

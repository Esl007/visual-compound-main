import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { url, type = "final", width, height, prompt_hash } = body || {};
    if (!url) return new Response("Missing url", { status: 400 });

    const { data, error } = await supabase
      .from("assets")
      .insert({ user_id: session.user.id, url, type, width, height, prompt_hash })
      .select("*")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ asset: data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

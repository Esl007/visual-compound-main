import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  try {
    const supabase = supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ assets: data || [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage/b2";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supa = supabaseServer();
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // 'user' | 'template' | null
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const from = Math.max(0, Number(url.searchParams.get("from") || 0));

    let query = supa.from("images").select("id,type,storage_path,created_at,metadata").order("created_at", { ascending: false }).range(from, from + limit - 1);
    if (type === "user" || type === "template") {
      query = query.eq("type", type);
    }
    const { data, error } = await query;
    if (error) {
      const msg = String((error as any)?.message || error);
      // If migration not applied yet, avoid hard-failing and return an empty list
      if (/Could not find the table|schema cache/i.test(msg)) {
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw error;
    }

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const out = await Promise.all(
      (data || []).map(async (row: any) => {
        const signed_url = await getSignedUrl({ bucket, key: row.storage_path, expiresInSeconds: 300 });
        return { ...row, signed_url };
      })
    );
    return new Response(JSON.stringify({ items: out }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

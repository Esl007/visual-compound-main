import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedUrl } from "@/lib/storage/b2";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    let supa: ReturnType<typeof supabaseServer> | ReturnType<typeof supabaseAdmin>;
    try {
      supa = supabaseServer();
    } catch {
      supa = supabaseAdmin();
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
    const from = Math.max(0, Number(searchParams.get("from") || 0));

    async function loadTemplates() {
      try {
        const q = (supa as any)
          .from("templates")
          .select("id,title,category,preview_image_path,thumbnail_400_path,thumbnail_600_path,featured,created_at")
          .eq("status", "published")
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + limit - 1);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        if (/unauthor/i.test(msg) || /invalid api key/i.test(msg) || /Missing NEXT_PUBLIC_SUPABASE_URL/i.test(msg)) {
          const supa2 = supabaseAdmin();
          const { data: data2, error: err2 } = await (supa2 as any)
            .from("templates")
            .select("id,title,category,preview_image_path,thumbnail_400_path,thumbnail_600_path,featured,created_at")
            .eq("status", "published")
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, from + limit - 1);
          if (err2) throw err2;
          return data2 || [];
        }
        if (/Could not find the table|schema cache/i.test(msg)) {
          return [];
        }
        throw err;
      }
    }

    const data = await loadTemplates();

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const items = await Promise.all(
      (data || []).map(async (row: any) => {
        const out: any = {
          id: row.id,
          title: row.title,
          category: row.category,
          featured: row.featured,
          created_at: row.created_at,
        };
        if (row.preview_image_path) {
          out.preview_url = await getSignedUrl({ bucket, key: row.preview_image_path, expiresInSeconds: 300 });
        }
        if (row.thumbnail_400_path) {
          out.thumb_400_url = await getSignedUrl({ bucket, key: row.thumbnail_400_path, expiresInSeconds: 300 });
        }
        if (row.thumbnail_600_path) {
          out.thumb_600_url = await getSignedUrl({ bucket, key: row.thumbnail_600_path, expiresInSeconds: 300 });
        }
        return out;
      })
    );

    return new Response(JSON.stringify({ items }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

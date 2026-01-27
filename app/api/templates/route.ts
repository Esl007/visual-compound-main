import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveTemplateCdnUrl } from "@/lib/storage/templateCdn";
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
    const byId = String(searchParams.get("id") || "").trim() || null;

    async function loadTemplates() {
      try {
        let q = (supa as any)
          .from("templates")
          .select("id,title,category,product_prompt,preview_image_path,background_image_path,thumbnail_400_path,thumbnail_600_path,featured,created_at")
          .eq("status", "published")
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false });
        if (byId) {
          q = q.eq("id", byId).range(0, 0);
        } else {
          q = q.range(from, from + limit - 1);
        }
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        if (/unauthor/i.test(msg) || /invalid api key/i.test(msg) || /Missing NEXT_PUBLIC_SUPABASE_URL/i.test(msg)) {
          const supa2 = supabaseAdmin();
          let q2 = (supa2 as any)
            .from("templates")
            .select("id,title,category,product_prompt,preview_image_path,background_image_path,thumbnail_400_path,thumbnail_600_path,featured,created_at")
            .eq("status", "published")
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false });
          if (byId) {
            q2 = q2.eq("id", byId).range(0, 0);
          } else {
            q2 = q2.range(from, from + limit - 1);
          }
          const { data: data2, error: err2 } = await q2;
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
    const bucket = process.env.S3_BUCKET as string | undefined;

    const items = await Promise.all(
      (data || []).map(async (row: any) => {
        const out: any = {
          id: row.id,
          title: row.title,
          category: row.category,
          product_prompt: row.product_prompt,
          featured: row.featured,
          created_at: row.created_at,
        };

        // preview (with legacy path fallback) — prefer CDN stable URL; fallback to long-lived signed URL only if needed
        {
          const candidates = [
            `users/admin-templates/${row.id}/preview.png`,
            row.preview_image_path,
            `templates/${row.id}/preview.png`,
          ].filter(Boolean) as string[];
          let url: string | null = null;
          for (const key of candidates) {
            try {
              const cdn = resolveTemplateCdnUrl(key);
              url = cdn; break;
            } catch {}
          }
          if (!url && bucket) {
            const key = candidates.find(Boolean) as string | undefined;
            if (key) {
              try { url = await getSignedUrl({ bucket, key, expiresInSeconds: 2592000 }); } catch {}
            }
          }
          out.preview_url = url || null;
        }

        // thumb_400 (with legacy path fallback)
        {
          const candidates = [
            `users/admin-templates/${row.id}/thumb_400.webp`,
            row.thumbnail_400_path,
            `templates/${row.id}/thumb_400.webp`,
          ].filter(Boolean) as string[];
          let url: string | null = null;
          for (const key of candidates) {
            try {
              const cdn = resolveTemplateCdnUrl(key);
              url = cdn; break;
            } catch {}
          }
          if (!url && bucket) {
            const key = candidates.find(Boolean) as string | undefined;
            if (key) {
              try { url = await getSignedUrl({ bucket, key, expiresInSeconds: 2592000 }); } catch {}
            }
          }
          out.thumb_400_url = url || null;
        }

        // thumb_600 (with legacy path fallback)
        {
          const candidates = [
            `users/admin-templates/${row.id}/thumb_600.webp`,
            row.thumbnail_600_path,
            `templates/${row.id}/thumb_600.webp`,
          ].filter(Boolean) as string[];
          let url: string | null = null;
          for (const key of candidates) {
            try {
              const cdn = resolveTemplateCdnUrl(key);
              url = cdn; break;
            } catch {}
          }
          if (!url && bucket) {
            const key = candidates.find(Boolean) as string | undefined;
            if (key) {
              try { url = await getSignedUrl({ bucket, key, expiresInSeconds: 2592000 }); } catch {}
            }
          }
          out.thumb_600_url = url || null;
        }

        out.thumbnail_url = out.thumb_400_url || out.thumb_600_url || out.preview_url || null;
        return out;
      })
    );

    return new Response(JSON.stringify({ items }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

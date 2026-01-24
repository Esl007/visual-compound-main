import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedUrl } from "@/lib/storage/b2";

export const runtime = "nodejs";

async function probeObject(bucket: string, key: string): Promise<{ exists: boolean; size: number | null; key: string }> {
  try {
    const url = await getSignedUrl({ bucket, key, expiresInSeconds: 180 });
    const r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } as any } as any);
    if (r.ok || r.status === 206) {
      const cr = r.headers.get("content-range") || r.headers.get("Content-Range");
      let size: number | null = null;
      if (cr && /\//.test(cr)) {
        const total = cr.split("/").pop();
        const n = Number(total);
        if (Number.isFinite(n)) size = Math.floor(n);
      }
      return { exists: true, size, key };
    }
  } catch {}
  return { exists: false, size: null, key };
}

export async function GET(req: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
    if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
    const headerToken = req.headers.get("x-admin-token");
    const cookieToken = req.cookies.get("admin-token")?.value;
    if (headerToken !== adminToken && cookieToken !== adminToken) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });

    const supa = supabaseAdmin();
    const { data, error } = await supa
      .from("templates")
      .select("id, original_image_path, background_image_path, thumbnail_400_path, thumbnail_600_path")
      .limit(200);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

    const rows = Array.isArray(data) ? data : [];
    const items = [] as Array<{
      id: string;
      original: { exists: boolean; size: number | null; key: string };
      thumb400: { exists: boolean; size: number | null; key: string };
      thumb600: { exists: boolean; size: number | null; key: string };
    }>;

    for (const row of rows) {
      const id = String((row as any).id);
      const originalKey = (row as any).original_image_path || (row as any).background_image_path || `templates/${id}/original.png`;
      const t400Key = (row as any).thumbnail_400_path || `templates/${id}/thumb_400.webp`;
      const t600Key = (row as any).thumbnail_600_path || `templates/${id}/thumb_600.webp`;

      const [orig, th4, th6] = await Promise.all([
        probeObject(bucket, originalKey),
        probeObject(bucket, t400Key),
        probeObject(bucket, t600Key),
      ]);
      items.push({ id, original: orig, thumb400: th4, thumb600: th6 });
    }

    return new Response(JSON.stringify({ count: items.length, items }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

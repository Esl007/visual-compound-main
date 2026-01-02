import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedUrl } from "@/lib/storage/b2";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function publishAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["draft", "published", "archived"].includes(status)) return;
  const supa = supabaseAdmin();
  await supa.from("templates").update({ status }).eq("id", id);
}

async function toggleFeaturedAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const featured = String(formData.get("featured") || "false") === "true";
  if (!id) return;
  const supa = supabaseAdmin();
  await supa.from("templates").update({ featured }).eq("id", id);
}

export default async function Page() {
  const supa = supabaseAdmin();
  const { data } = await supa
    .from("templates")
    .select("id,title,category,status,featured,preview_image_path,thumbnail_400_path,thumbnail_600_path,created_at")
    .order("created_at", { ascending: false });

  const bucket = process.env.S3_BUCKET as string;
  const rows = await Promise.all(
    (data || []).map(async (t: any) => {
      const preview_url = t.preview_image_path ? await getSignedUrl({ bucket, key: t.preview_image_path, expiresInSeconds: 300 }) : null;
      const thumb_400_url = t.thumbnail_400_path ? await getSignedUrl({ bucket, key: t.thumbnail_400_path, expiresInSeconds: 300 }) : null;
      const thumb_600_url = t.thumbnail_600_path ? await getSignedUrl({ bucket, key: t.thumbnail_600_path, expiresInSeconds: 300 }) : null;
      return { ...t, preview_url, thumb_400_url, thumb_600_url };
    })
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Templates</h1>
        <Link className="btn" href="/templates">View Public Templates</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Preview</th>
              <th className="p-2">Title</th>
              <th className="p-2">Category</th>
              <th className="p-2">Status</th>
              <th className="p-2">Featured</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t: any) => (
              <tr key={t.id} className="border-b align-top">
                <td className="p-2">
                  {t.thumb_400_url || t.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumb_400_url || t.preview_url} alt={t.title} className="w-24 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-24 h-16 bg-muted rounded" />)
                  }
                </td>
                <td className="p-2">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-muted-foreground text-xs">{t.id}</div>
                </td>
                <td className="p-2">{t.category}</td>
                <td className="p-2">
                  <form action={publishAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="status" defaultValue={t.status} className="select select-sm">
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                      <option value="archived">archived</option>
                    </select>
                    <button type="submit" className="btn btn-sm">Update</button>
                  </form>
                </td>
                <td className="p-2">
                  <form action={toggleFeaturedAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="featured" defaultValue={String(!!t.featured)} className="select select-sm">
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                    <button type="submit" className="btn btn-sm">Save</button>
                  </form>
                </td>
                <td className="p-2 space-x-2">
                  <Link className="btn btn-sm" href={`/generate?templateId=${t.id}`}>Use</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

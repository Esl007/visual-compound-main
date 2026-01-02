import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedUrl } from "@/lib/storage/b2";
import Link from "next/link";
import { cookies } from "next/headers";
import { uploadImage, cacheControlForKey } from "@/lib/storage/b2";
import { generateAndUploadThumbnails, reencodeToPng } from "@/lib/images/thumbs";
import { buildTemplateAssetPaths } from "@/lib/images/paths";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

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

async function createTemplateAction(formData: FormData) {
  "use server";
  const id = randomUUID();
  const title = String(formData.get("title") || "Untitled");
  const category = String(formData.get("category") || "General");
  const background_prompt = formData.get("background_prompt") ? String(formData.get("background_prompt")) : null;
  const product_prompt = formData.get("product_prompt") ? String(formData.get("product_prompt")) : null;
  const featured = String(formData.get("featured") || "false") === "true";
  const supa = supabaseAdmin();
  await supa.from("templates").insert({ id, title, category, background_prompt, product_prompt, status: "draft", featured });
  revalidatePath("/admin/templates");
}

async function uploadBackgroundAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const file = formData.get("background") as unknown as File | null;
  if (!id || !file) return;
  const bucket = process.env.S3_BUCKET as string;
  if (!bucket) return;
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const png = await reencodeToPng(buf);
  const paths = buildTemplateAssetPaths(id);
  await uploadImage({ bucket, key: paths.original, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.original) });
  const thumbs = await generateAndUploadThumbnails({ input: png, bucket, outputBasePath: paths.base });
  const t400 = thumbs.find((t) => t.size === 400)?.path || null;
  const t600 = thumbs.find((t) => t.size === 600)?.path || null;
  const supa = supabaseAdmin();
  await supa.from("templates").update({ background_image_path: paths.original, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/templates");
}

async function uploadPreviewAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const file = formData.get("preview") as unknown as File | null;
  if (!id || !file) return;
  const bucket = process.env.S3_BUCKET as string;
  if (!bucket) return;
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const png = await reencodeToPng(buf);
  const paths = buildTemplateAssetPaths(id);
  await uploadImage({ bucket, key: paths.preview, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });
  const supa = supabaseAdmin();
  await supa.from("templates").update({ preview_image_path: paths.preview, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/templates");
}


export default async function Page() {
  const token = cookies().get("admin-token")?.value || "";
  const adminToken = process.env.ADMIN_UPLOAD_TOKEN || "";
  if (!adminToken || token !== adminToken) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="text-muted-foreground mt-2">Missing or invalid admin token.</p>
      </div>
    );
  }
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
      <div className="rounded border p-4 mt-4">
        <form action={createTemplateAction} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Title</label>
            <input name="title" placeholder="Title" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm mb-1">Category</label>
            <input name="category" placeholder="Category" className="input w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Background Prompt</label>
            <input name="background_prompt" placeholder="Background prompt" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm mb-1">Product Prompt</label>
            <input name="product_prompt" placeholder="Product prompt" className="input w-full" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Featured</label>
            <select name="featured" defaultValue="false" className="select">
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <div>
            <button type="submit" className="btn">Create Draft</button>
          </div>
        </form>
      </div>
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
                <td className="p-2 space-y-2">
                  <form action={uploadBackgroundAction} className="flex items-center gap-2" encType="multipart/form-data">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="file" name="background" accept="image/*" className="input input-sm" />
                    <button type="submit" className="btn btn-sm">Upload BG</button>
                  </form>
                  <form action={uploadPreviewAction} className="flex items-center gap-2" encType="multipart/form-data">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="file" name="preview" accept="image/*" className="input input-sm" />
                    <button type="submit" className="btn btn-sm">Upload Preview</button>
                  </form>
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

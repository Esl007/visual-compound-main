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
export const runtime = "nodejs";

async function publishAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["draft", "published", "archived"].includes(status)) return;
  const supa = supabaseAdmin();
  if (status === "published") {
    const { data: t } = await supa
      .from("templates")
      .select("id, background_image_path, preview_image_path, background_prompt, product_prompt, category_id, category")
      .eq("id", id)
      .single();
    const hasCategory = !!(t?.category_id || t?.category);
    const hasBG = !!t?.background_image_path;
    const hasPreview = !!t?.preview_image_path;
    const hasPrompts = !!(t?.background_prompt && t?.product_prompt);
    if (!hasCategory || !hasBG || !hasPreview || !hasPrompts) return;
    const { error } = await supa
      .from("templates")
      .update({ status: "published", published_at: new Date().toISOString() as any, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      // Fallback if published_at column is missing
      await supa.from("templates").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", id);
    }
  } else {
    await supa.from("templates").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

async function toggleFeaturedAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const featured = String(formData.get("featured") || "false") === "true";
  if (!id) return;
  const supa = supabaseAdmin();
  await supa.from("templates").update({ featured }).eq("id", id);
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

async function createTemplateAction(formData: FormData) {
  "use server";
  const id = randomUUID();
  const title = String(formData.get("title") || "Untitled");
  const category_id = formData.get("category_id") ? String(formData.get("category_id")) : null;
  let category = formData.get("category") ? String(formData.get("category")) : "General"; // fallback for legacy
  const background_prompt = formData.get("background_prompt") ? String(formData.get("background_prompt")) : null;
  const product_prompt = formData.get("product_prompt") ? String(formData.get("product_prompt")) : null;
  const featured = String(formData.get("featured") || "false") === "true";
  const supa = supabaseAdmin();
  const bucket = process.env.S3_BUCKET as string;
  const paths = buildTemplateAssetPaths(id);
  let bgPath: string | null = null;
  let previewPath: string | null = null;
  let t400: string | null = null;
  let t600: string | null = null;
  // If a category_id is provided, resolve its name and mirror it to the legacy 'category' column
  if (category_id) {
    const { data: cat } = await supa.from("template_categories").select("name").eq("id", category_id).single();
    if (cat?.name) category = cat.name;
  }

  if (bucket) {
    const bg = formData.get("background") as unknown as File | null;
    if (bg) {
      const buf = Buffer.from(await (bg as File).arrayBuffer());
      const png = await reencodeToPng(buf);
      await uploadImage({ bucket, key: paths.original, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.original) });
      const thumbs = await generateAndUploadThumbnails({ input: png, bucket, outputBasePath: paths.base });
      t400 = thumbs.find((t) => t.size === 400)?.path || null;
      t600 = thumbs.find((t) => t.size === 600)?.path || null;
      bgPath = paths.original;
    }
    const comp = formData.get("composite") as unknown as File | null;
    if (comp) {
      const buf2 = Buffer.from(await (comp as File).arrayBuffer());
      const png2 = await reencodeToPng(buf2);
      await uploadImage({ bucket, key: paths.preview, body: png2, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });
      const thumbs2 = await generateAndUploadThumbnails({ input: png2, bucket, outputBasePath: paths.base });
      t400 = thumbs2.find((t) => t.size === 400)?.path || t400;
      t600 = thumbs2.find((t) => t.size === 600)?.path || t600;
      previewPath = paths.preview;
    }
  }
  // Try insert with category_id, and fall back if column doesn't exist
  let { error: insertErr } = await supa.from("templates").insert({
    id,
    title,
    category_id,
    category,
    background_prompt,
    product_prompt,
    background_image_path: bgPath,
    preview_image_path: previewPath,
    thumbnail_400_path: t400,
    thumbnail_600_path: t600,
    status: "draft",
    featured,
  } as any);
  if (insertErr) {
    await supa.from("templates").insert({
      id,
      title,
      category,
      background_prompt,
      product_prompt,
      background_image_path: bgPath,
      preview_image_path: previewPath,
      thumbnail_400_path: t400,
      thumbnail_600_path: t600,
      status: "draft",
      featured,
    } as any);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
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
  revalidatePath("/admin/templates1");
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
  revalidatePath("/admin/templates1");
}

async function uploadCompositeAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const file = formData.get("composite") as unknown as File | null;
  if (!id || !file) return;
  const bucket = process.env.S3_BUCKET as string;
  if (!bucket) return;
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const png = await reencodeToPng(buf);
  const paths = buildTemplateAssetPaths(id);
  await uploadImage({ bucket, key: paths.preview, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });
  const thumbs = await generateAndUploadThumbnails({ input: png, bucket, outputBasePath: paths.base });
  const t400 = thumbs.find((t) => t.size === 400)?.path || null;
  const t600 = thumbs.find((t) => t.size === 600)?.path || null;
  const supa = supabaseAdmin();
  await supa.from("templates").update({ preview_image_path: paths.preview, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}



async function addCategoryAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const id = randomUUID();
  const supa = supabaseAdmin();
  await supa.from("template_categories").insert({ id, name });
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
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
  try {
    const defaults = [
      "Hero Shot",
      "Lifestyle",
      "Studio",
      "Minimal Product",
      "Outdoor",
    ];
    const { data: existing, error: exErr } = await supa.from("template_categories").select("name");
    if (!exErr) {
      const existingSet = new Set((existing || []).map((r: any) => String(r.name).trim().toLowerCase()));
      const toInsert = defaults
        .filter((n) => !existingSet.has(n.toLowerCase()))
        .map((name) => ({ id: randomUUID(), name }));
      if (toInsert.length) await supa.from("template_categories").insert(toInsert);
    } else {
      const { data: existing2 } = await supa.from("categories").select("name");
      const existingSet2 = new Set((existing2 || []).map((r: any) => String(r.name).trim().toLowerCase()));
      const toInsert2 = defaults
        .filter((n) => !existingSet2.has(n.toLowerCase()))
        .map((name) => ({ id: randomUUID(), name }));
      if (toInsert2.length) await supa.from("categories").insert(toInsert2);
    }
  } catch (_) {
  }
  let categories: any[] | null = null;
  let usingLegacyCategories = false;
  {
    const { data, error } = await supa
      .from("template_categories")
      .select("id,name")
      .order("name", { ascending: true });
    if (!error) {
      categories = data || [];
    } else {
      usingLegacyCategories = true;
      const { data: data2 } = await supa
        .from("categories")
        .select("id,name")
        .order("name", { ascending: true });
      categories = data2 || [];
    }
  }
  const categoryMap = new Map<string, string>((categories || []).map((c: any) => [c.id, c.name]));
  const { data } = await supa
    .from("templates")
    .select("id,title,category,category_id,status,featured,preview_image_path,thumbnail_400_path,thumbnail_600_path,created_at")
    .order("created_at", { ascending: false });

  const bucket = process.env.S3_BUCKET as string;
  const rows = await Promise.all(
    (data || []).map(async (t: any) => {
      const preview_url = t.preview_image_path ? await getSignedUrl({ bucket, key: t.preview_image_path, expiresInSeconds: 300 }) : null;
      const thumb_400_url = t.thumbnail_400_path ? await getSignedUrl({ bucket, key: t.thumbnail_400_path, expiresInSeconds: 300 }) : null;
      const thumb_600_url = t.thumbnail_600_path ? await getSignedUrl({ bucket, key: t.thumbnail_600_path, expiresInSeconds: 300 }) : null;
      const category_name = t.category_id ? (categoryMap.get(t.category_id) || null) : (t.category || null);
      return { ...t, preview_url, thumb_400_url, thumb_600_url, category_name };
    })
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Templates</h1>
        <Link className="px-3 py-2 rounded border text-sm bg-white text-black hover:bg-gray-50" href="/templates">View Public Templates</Link>
      </div>
      <div className="rounded border p-4">
        <form action="/api/admin/categories?redirect=1" method="POST" className="flex items-center gap-2 mb-4">
          <label className="block text-sm">Add Category</label>
          <input name="name" placeholder="New category name" className="px-3 py-2 border rounded bg-white text-black placeholder:text-gray-500" />
          <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Add</button>
        </form>
        <form action="/api/admin/templates?redirect=1" method="POST" className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Title</label>
            <input name="title" placeholder="Title" className="w-full px-3 py-2 border rounded bg-white text-black placeholder:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm mb-1">Category</label>
            {((categories || []).length > 0) ? (
              <select name={usingLegacyCategories ? "category" : "category_id"} className="w-full px-3 py-2 border rounded bg-white text-black">
                <option value="">Select a category</option>
                {(categories || []).map((c: any) => (
                  <option key={c.id} value={usingLegacyCategories ? c.name : c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input name="category" placeholder="Category" className="w-full px-3 py-2 border rounded bg-white text-black placeholder:text-gray-500" />
            )}
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Background Prompt</label>
            <textarea name="background_prompt" placeholder="Background prompt" rows={3} className="w-full px-3 py-2 border rounded bg-white text-black placeholder:text-gray-500"></textarea>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Product Prompt</label>
            <textarea name="product_prompt" placeholder="Product prompt" rows={3} className="w-full px-3 py-2 border rounded bg-white text-black placeholder:text-gray-500"></textarea>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Featured</label>
            <select name="featured" defaultValue="false" className="px-3 py-2 border rounded bg-white text-black">
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <div>
            <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Create Draft</button>
          </div>
        </form>
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
                <td className="p-2">{t.category_name || t.category || "-"}</td>
                <td className="p-2">
                  <form action={publishAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="status" defaultValue={t.status} className="px-2 py-1 border rounded bg-white text-black text-sm">
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                      <option value="archived">archived</option>
                    </select>
                    <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Update</button>
                  </form>
                  <form action={publishAction} className="mt-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value="published" />
                    <button type="submit" className="px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700">Publish</button>
                  </form>
                </td>
                <td className="p-2">
                  <form action={toggleFeaturedAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="featured" defaultValue={String(!!t.featured)} className="px-2 py-1 border rounded bg-white text-black text-sm">
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                    <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save</button>
                  </form>
                </td>
                <td className="p-2 space-y-2">
                  <form action={uploadBackgroundAction} className="flex items-center gap-2" encType="multipart/form-data">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="file" name="background" accept="image/*" className="block text-sm bg-white text-black border rounded px-2 py-1" />
                    <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Upload BG</button>
                  </form>
                  <form action={uploadPreviewAction} className="flex items-center gap-2" encType="multipart/form-data">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="file" name="preview" accept="image/*" className="block text-sm bg-white text-black border rounded px-2 py-1" />
                    <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Upload Preview</button>
                  </form>
                  <form action={uploadCompositeAction} className="flex items-center gap-2" encType="multipart/form-data">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="file" name="composite" accept="image/*" className="block text-sm bg-white text-black border rounded px-2 py-1" />
                    <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Upload BG+Product</button>
                  </form>
                  <Link className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700" href={`/generate?templateId=${t.id}`}>Use</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

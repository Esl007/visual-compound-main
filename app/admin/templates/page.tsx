import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedUrl } from "@/lib/storage/b2";
import Link from "next/link";
import { cookies } from "next/headers";
import { uploadImageWithVerify, uploadImage, cacheControlForKey, deleteImage } from "@/lib/storage/b2";
import { generateAndUploadThumbnails, reencodeToPng } from "@/lib/images/thumbs";
import { buildAdminTemplateAssetPaths } from "@/lib/images/paths";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { PendingButton } from "./PendingButton";
import DirectUpload from "./DirectUpload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function publishAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["draft", "published", "archived"].includes(status)) return;
  try {
    const supa = supabaseAdmin();
    if (status === "published") {
      const { error } = await supa
        .from("templates")
        .update({ status: "published", published_at: new Date().toISOString() as any, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        await supa.from("templates").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", id);
      }
    
    } else {
      await supa.from("templates").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Publish failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

// Server actions added for admin/templates1 enhancements
async function updatePromptsAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const background_prompt = formData.get("background_prompt") ? String(formData.get("background_prompt")) : null;
  const product_prompt = formData.get("product_prompt") ? String(formData.get("product_prompt")) : null;
  if (!id) return;
  try {
    const supa = supabaseAdmin();
    await supa
      .from("templates")
      .update({ background_prompt, product_prompt, updated_at: new Date().toISOString() })
      .eq("id", id);
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Save prompts failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

async function updateTagsAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tagsText = String(formData.get("tags") || "");
  if (!id) return;
  const tags = Array.from(new Set(tagsText.split(",").map((t) => t.trim()).filter(Boolean))).slice(0, 20);
  try {
    const supa = supabaseAdmin();
    // First try direct column on templates (text[] / jsonb[])
    const { error } = await supa.from("templates").update({ tags, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) {
      // Fallback: try metadata JSON column merge
      try {
        const { data: row } = await supa.from("templates").select("metadata").eq("id", id).single();
        const meta = (row?.metadata && typeof row.metadata === "object") ? row.metadata : {};
        (meta as any).tags = tags;
        const { error: e2 } = await supa.from("templates").update({ metadata: meta, updated_at: new Date().toISOString() } as any).eq("id", id);
        if (!e2) {
          revalidatePath("/admin/templates");
          revalidatePath("/admin/templates1");
          return;
        }
      } catch {}
      // Last fallback: use template_tags mapping table (delete + insert)
      try {
        await supa.from("template_tags").delete().eq("template_id", id);
        if (tags.length) {
          await supa.from("template_tags").insert(tags.map((tag) => ({ template_id: id, tag })) as any);
        }
      } catch {}
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Save tags failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

async function deleteDraftAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  try {
    const supa = supabaseAdmin();
    const bucket = process.env.S3_BUCKET as string;
    // Load paths to delete
    const { data: t } = await supa
      .from("templates")
      .select("background_image_path, preview_image_path, thumbnail_400_path, thumbnail_600_path, status")
      .eq("id", id)
      .single();
    if ((t?.status || "").toLowerCase() === "published") {
      throw new Error("Cannot delete a published template");
    }
    const keys = [t?.background_image_path, t?.preview_image_path, t?.thumbnail_400_path, t?.thumbnail_600_path].filter(Boolean) as string[];
    for (const key of keys) {
      try { await deleteImage({ bucket, key }); } catch {}
    }
    await supa.from("templates").delete().eq("id", id);
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Delete failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

async function updateCategoryAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const category_id = formData.get("category_id") ? String(formData.get("category_id")) : "";
  const category = formData.get("category") ? String(formData.get("category")) : "";
  if (!id) return;
  try {
    const supa = supabaseAdmin();
    let name: string | null = null;
    let catId: string | null = null;
    if (category_id) {
      catId = category_id;
      const { data: cat } = await supa.from("template_categories").select("name").eq("id", category_id).single();
      name = cat?.name || null;
    } else if (category) {
      name = category;
    } else {
      return;
    }
    const payload: any = { updated_at: new Date().toISOString() };
    if (name !== null) payload.category = name;
    if (catId) payload.category_id = catId;
    const { error } = await supa.from("templates").update(payload).eq("id", id);
    if (error) {
      if (name !== null) {
        await supa.from("templates").update({ category: name, updated_at: new Date().toISOString() } as any).eq("id", id);
      }
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Update category failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

async function toggleFeaturedAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const featured = String(formData.get("featured") || "false") === "true";
  if (!id) return;
  try {
    const supa = supabaseAdmin();
    await supa.from("templates").update({ featured }).eq("id", id);
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Save failed")}`);
  }
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
  try {
    const supa = supabaseAdmin();
    const bucket = process.env.S3_BUCKET as string;
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
        const paths = buildAdminTemplateAssetPaths(id);
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
        const paths = buildAdminTemplateAssetPaths(id);
        await uploadImageWithVerify({ bucket, key: paths.preview, body: png2, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });
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
      const { error: e2 } = await supa.from("templates").insert({
        id,
        title,
        category,
        background_prompt,
        product_prompt,
        status: "draft",
        featured,
      } as any);
      if (e2) {
        const { error: e3 } = await supa.from("templates").insert({ id, title, category } as any);
        if (e3) {
          throw new Error(e3.message || "Create draft failed");
        }
      }
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Create failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
  redirect(`/admin/templates1?created=${id}`);
}

async function uploadBackgroundAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const file = formData.get("background") as unknown as File | null;
  if (!id || !file) return;
  try {
    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) throw new Error("Missing S3_BUCKET");
    const buf = Buffer.from(await (file as File).arrayBuffer());
    const png = await reencodeToPng(buf);
    const paths = buildAdminTemplateAssetPaths(id);
    await uploadImage({ bucket, key: paths.original, body: png, contentType: "image/png", cacheControl: cacheControlForKey(paths.original) });
    const thumbs = await generateAndUploadThumbnails({ input: png, bucket, outputBasePath: paths.base });
    const t400 = thumbs.find((t) => t.size === 400)?.path || null;
    const t600 = thumbs.find((t) => t.size === 600)?.path || null;
    const supa = supabaseAdmin();
    const { error } = await supa
      .from("templates")
      .update({ background_image_path: paths.original, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      await supa
        .from("templates")
        .update({ background_image_path: paths.original, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Upload background failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}

 

async function uploadCompositeAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const file = (formData.get("product") as unknown as File | null) || (formData.get("composite") as unknown as File | null);
  if (!id || !file) return;
  try {
    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) throw new Error("Missing S3_BUCKET");
    const buf = Buffer.from(await (file as File).arrayBuffer());
    const productPng = await reencodeToPng(buf);
    const paths = buildAdminTemplateAssetPaths(id);
    // Load background image for this template
    const supa = supabaseAdmin();
    const { data: tmpl } = await supa
      .from("templates")
      .select("background_image_path")
      .eq("id", id)
      .single();
    const bgKey: string | null = tmpl?.background_image_path || null;
    let composed: Buffer = productPng;
    if (bgKey) {
      const bgUrl = await getSignedUrl({ bucket, key: bgKey, expiresInSeconds: 120 });
      if (bgUrl) {
        const r = await fetch(bgUrl);
        if (r.ok) {
          const bgBuf = Buffer.from(await r.arrayBuffer());
          try {
            composed = await sharp(bgBuf).composite([{ input: productPng }]).png().toBuffer();
          } catch (_) {
            composed = productPng;
          }
        }
      }
    }
    await uploadImageWithVerify({ bucket, key: paths.preview, body: composed, contentType: "image/png", cacheControl: cacheControlForKey(paths.preview) });
    const thumbs = await generateAndUploadThumbnails({ input: composed, bucket, outputBasePath: paths.base });
    const t400 = thumbs.find((t) => t.size === 400)?.path || null;
    const t600 = thumbs.find((t) => t.size === 600)?.path || null;
    const { error: upErr } = await supa
      .from("templates")
      .update({ preview_image_path: paths.preview, thumbnail_400_path: t400, thumbnail_600_path: t600, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) {
      await supa
        .from("templates")
        .update({ preview_image_path: paths.preview, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Upload product failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
}



async function addCategoryAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const id = randomUUID();
  try {
    const supa = supabaseAdmin();
    const { error } = await supa.from("template_categories").insert({ id, name });
    if (error) {
      const msg = String(error.message || "");
      // If table missing, fall back to legacy table
      if (/Could not find the table|does not exist|schema cache/i.test(msg)) {
        await supa.from("categories").insert({ id, name });
      } else if (/duplicate key value|already exists|duplicate entry/i.test(msg)) {
        // Ignore duplicates to behave like idempotent add
      } else {
        // Last resort: try legacy table as well
        try { await supa.from("categories").insert({ id, name }); } catch {}
      }
    }
  } catch (e: any) {
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates1");
    redirect(`/admin/templates1?err=${encodeURIComponent(e?.message || "Add category failed")}`);
  }
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates1");
  redirect("/admin/templates1");
}

export default async function Page({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
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
  // Sync categories between legacy and new tables so dropdown always reflects additions
  try {
    const { data: tcats } = await supa.from("template_categories").select("name");
    const { data: lcats } = await supa.from("categories").select("name");
    const tset = new Set((tcats || []).map((r: any) => String(r.name).trim().toLowerCase()));
    const toAdd = (lcats || []).map((r: any) => String(r.name).trim()).filter((n) => n && !tset.has(n.toLowerCase()));
    if (toAdd.length) {
      await supa.from("template_categories").insert(toAdd.map((name) => ({ id: randomUUID(), name })) as any);
    }
  } catch {}
  let categories: any[] | null = null;
  let usingLegacyCategories = false;
  {
    let tcat: any[] = [];
    try {
      const { data } = await supa.from("template_categories").select("id,name").order("name", { ascending: true });
      tcat = data || [];
    } catch {}
    let lcat: any[] = [];
    try {
      const { data } = await supa.from("categories").select("id,name").order("name", { ascending: true });
      lcat = data || [];
    } catch {}
    if ((tcat || []).length > 0) {
      categories = tcat;
      usingLegacyCategories = false;
    } else {
      categories = lcat;
      usingLegacyCategories = true;
    }
  }
  let data: any[] | null = null;
  {
    const q1 = await supa
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (!q1.error) {
      data = q1.data || [];
    } else {
      const q2 = await supa.from("templates").select("*");
      data = q2.data || [];
    }
  }
  // If no categories were found in either table, derive from templates.category values
  if (!categories || categories.length === 0) {
    const set = new Set<string>();
    (data || []).forEach((t: any) => {
      if (t?.category) set.add(String(t.category));
    });
    categories = Array.from(set).map((name) => ({ id: name, name }));
    usingLegacyCategories = true;
  }
  // Build mapping after final categories derivation
  const categoryMap = new Map<string, string>((categories || []).map((c: any) => [c.id, c.name]));

  const bucket = process.env.S3_BUCKET as string;
  const rows = await Promise.all(
    (data || []).map(async (t: any) => {
      const preview_url = t.preview_image_path
        ? await getSignedUrl({ bucket, key: t.preview_image_path, expiresInSeconds: 300 })
        : (t.background_image_path
          ? await getSignedUrl({ bucket, key: t.background_image_path, expiresInSeconds: 300 })
          : null);
      const thumb_400_url = t.thumbnail_400_path ? await getSignedUrl({ bucket, key: t.thumbnail_400_path, expiresInSeconds: 300 }) : null;
      const thumb_600_url = t.thumbnail_600_path ? await getSignedUrl({ bucket, key: t.thumbnail_600_path, expiresInSeconds: 300 }) : null;
      const category_name = t.category_id ? (categoryMap.get(t.category_id) || null) : (t.category || null);
      return { ...t, preview_url, thumb_400_url, thumb_600_url, category_name };
    })
  );

  const createdId = typeof searchParams?.["created"] === "string" ? String(searchParams?.["created"]) : Array.isArray(searchParams?.["created"]) ? String(searchParams?.["created"]?.[0] || "") : "";
  const latestDraftId = createdId || (rows.find((t: any) => (t.status || "").toLowerCase() === "draft")?.id || "");
  const errMsg = typeof searchParams?.["err"] === "string" ? String(searchParams?.["err"]) : Array.isArray(searchParams?.["err"]) ? String(searchParams?.["err"]?.[0] || "") : "";
  const okMsg = typeof searchParams?.["msg"] === "string" ? String(searchParams?.["msg"]) : Array.isArray(searchParams?.["msg"]) ? String(searchParams?.["msg"]?.[0] || "") : "";
  return (
    <div className="p-8 space-y-6">
      {errMsg ? (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-3 py-2">{errMsg}</div>
      ) : null}
      {okMsg ? (
        <div className="rounded border border-green-300 bg-green-50 text-green-800 px-3 py-2">{okMsg}</div>
      ) : null}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Templates</h1>
        <Link className="px-3 py-2 rounded border text-sm bg-white text-black hover:bg-gray-50" href="/templates">View Public Templates</Link>
      </div>
      {latestDraftId ? (
        <div className="rounded border p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Upload assets for new draft</h2>
            <Link href="/admin/templates1" className="text-sm underline">Close</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <DirectUpload id={latestDraftId} kind="background" label="Upload BG" token={token} />
            <DirectUpload id={latestDraftId} kind="product" label="Upload Product" token={token} />
          </div>
        </div>
      ) : null}
      <div className="rounded border p-4">
        <form action={addCategoryAction} method="POST" className="flex items-center gap-2 mb-4">
          <label className="block text-sm">Add Category</label>
          <input name="name" placeholder="New category name" className="px-3 py-2 border rounded bg-white text-black placeholder:text-gray-500" />
          <PendingButton pendingText="Adding..." className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Add</PendingButton>
        </form>
        <form action={createTemplateAction} method="POST" className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
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
            <PendingButton pendingText="Creating..." className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Create Draft</PendingButton>
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
                <td className="p-2">
                  <form action={updateCategoryAction} method="POST" className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    {((categories || []).length > 0) ? (
                      <select
                        name={usingLegacyCategories ? "category" : "category_id"}
                        defaultValue={usingLegacyCategories ? (t.category || "") : (t.category_id || "")}
                        className="px-2 py-1 border rounded bg-white text-black text-sm"
                      >
                        <option value="">Select a category</option>
                        {(categories || []).map((c: any) => (
                          <option key={c.id} value={usingLegacyCategories ? c.name : c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input name="category" defaultValue={t.category || ""} placeholder="Category" className="px-2 py-1 border rounded bg-white text-black text-sm placeholder:text-gray-500" />
                    )}
                    <PendingButton pendingText="Saving..." className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save</PendingButton>
                  </form>
                </td>
                <td className="p-2">
                  <form action={publishAction} method="POST" className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="status" defaultValue={t.status} className="px-2 py-1 border rounded bg-white text-black text-sm">
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                      <option value="archived">archived</option>
                    </select>
                    <PendingButton pendingText="Updating..." className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Update</PendingButton>
                  </form>
                  <form action={publishAction} method="POST" className="mt-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value="published" />
                    <PendingButton pendingText="Publishing..." className="px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700">Publish</PendingButton>
                  </form>
                </td>
                <td className="p-2">
                  <form action={toggleFeaturedAction} method="POST" className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="featured" defaultValue={String(!!t.featured)} className="px-2 py-1 border rounded bg-white text-black text-sm">
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                    <PendingButton pendingText="Saving..." className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save</PendingButton>
                  </form>
                </td>
                <td className="p-2 space-y-2">
                  <DirectUpload id={t.id} kind="background" label="Upload BG" token={token} />
                  <DirectUpload id={t.id} kind="product" label="Upload Product" token={token} />
                  <form action={updatePromptsAction} method="POST" className="space-y-2">
                    <input type="hidden" name="id" value={t.id} />
                    <div>
                      <label className="block text-xs mb-1">Background Prompt</label>
                      <textarea name="background_prompt" rows={2} defaultValue={t.background_prompt || ""} className="w-full px-2 py-1 border rounded bg-white text-black text-xs placeholder:text-gray-500"></textarea>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Product Prompt</label>
                      <textarea name="product_prompt" rows={2} defaultValue={t.product_prompt || ""} className="w-full px-2 py-1 border rounded bg-white text-black text-xs placeholder:text-gray-500"></textarea>
                    </div>
                    <PendingButton pendingText="Saving..." className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save Prompts</PendingButton>
                  </form>
                  <form action={updateTagsAction} method="POST" className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="tags" placeholder="tag1, tag2" defaultValue={Array.isArray(t.tags) ? t.tags.join(", ") : (Array.isArray(t.metadata?.tags) ? t.metadata.tags.join(", ") : "")} className="flex-1 px-2 py-1 border rounded bg-white text-black text-xs placeholder:text-gray-500" />
                    <PendingButton pendingText="Saving..." className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save Tags</PendingButton>
                  </form>
                  <form action={deleteDraftAction} method="POST" className="pt-1">
                    <input type="hidden" name="id" value={t.id} />
                    <PendingButton pendingText="Deleting..." className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700">Delete Draft</PendingButton>
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

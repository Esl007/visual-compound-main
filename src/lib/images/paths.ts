import { randomUUID } from "crypto";

export function extFromMime(mime: string): string {
  if (!mime) return "bin";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  if (mime === "image/gif") return "gif";
  return mime.split("/").pop() || "bin";
}

export function buildUserPath(userId: string, imageId?: string, ext = "png") {
  const id = imageId || randomUUID();
  return { id, key: `users/${userId}/${id}.${ext}` };
}

export function buildTemplatePath(category: string, templateId?: string, ext = "png") {
  const id = templateId || randomUUID();
  const cleanCat = category.replace(/[^a-z0-9-_\/]/gi, "-");
  return { id, key: `templates/${cleanCat}/${id}.${ext}` };
}

export function buildTemplateAssetPaths(templateId: string) {
  const base = `templates/${templateId}`;
  return {
    base,
    original: `${base}/original.png`,
    preview: `${base}/preview.png`,
    thumb400: `${base}/thumb_400.webp`,
    thumb600: `${base}/thumb_600.webp`,
  } as const;
}

export function buildAdminTemplateAssetPaths(templateId: string) {
  // Follow the working routing used by user images to satisfy Backblaze key prefix constraints
  const base = `users/admin-templates/${templateId}`;
  return {
    base,
    original: `${base}/original.png`,
    preview: `${base}/preview.png`,
    thumb400: `${base}/thumb_400.webp`,
    thumb600: `${base}/thumb_600.webp`,
  } as const;
}

// IMPORTANT:
// CDN is applied ONLY to admin templates.
// User assets must NEVER go through this function.

const TEMPLATE_PREFIX = "/users/admin-templates/";

export function getTemplateImageUrl(originalUrl: string): string {
  try {
    const baseRaw = (process.env.B2_CDN_BASE || "").trim();
    if (!baseRaw) return originalUrl;

    const at = originalUrl.indexOf(TEMPLATE_PREFIX);
    if (at === -1) return originalUrl;

    let end = originalUrl.length;
    const q = originalUrl.indexOf("?", at);
    const h = originalUrl.indexOf("#", at);
    if (q !== -1) end = Math.min(end, q);
    if (h !== -1) end = Math.min(end, h);

    // Slice from the start of the template prefix, but drop leading slash if any
    let path = originalUrl.slice(at);
    path = path.slice(path.startsWith("/") ? 1 : 0);
    path = path.slice(0, path.length - (originalUrl.length - end));

    const cleanedBase = baseRaw.replace(/\/+$/, "");
    const cleanedPath = path.replace(/^\/+/, "");
    return `${cleanedBase}/${cleanedPath}`;
  } catch {
    return originalUrl;
  }
}

import "server-only";

const TEMPLATE_PREFIX = "users/admin-templates/";

export function resolveTemplateCdnUrl(path: string): string {
  if (!path.startsWith(TEMPLATE_PREFIX)) {
    throw new Error("CDN access denied: not a template path");
  }

  if (!/(thumb_|preview)/.test(path)) {
    throw new Error("CDN access denied: original images are forbidden");
  }

  const base = process.env.B2_CDN_BASE;
  if (!base) {
    throw new Error("B2_CDN_BASE not configured");
  }

  return `${base}/${path}`;
}

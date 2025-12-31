import { NextRequest } from "next/server";
export const runtime = "nodejs";

function cleanEnv(val?: string | null) {
  if (!val) return undefined;
  const s = String(val).trim();
  return s.length ? s : undefined;
}

export async function GET(_req: NextRequest) {
  const bucket = cleanEnv(process.env.S3_BUCKET);
  const endpoint = cleanEnv(process.env.S3_ENDPOINT);
  const region = cleanEnv(process.env.S3_REGION);
  const forcePathStyle = cleanEnv(process.env.S3_FORCE_PATH_STYLE)?.toLowerCase() !== "false";
  const hasAccessKeyId = Boolean(cleanEnv(process.env.S3_ACCESS_KEY_ID));
  const hasSecretAccessKey = Boolean(cleanEnv(process.env.S3_SECRET_ACCESS_KEY));

  // expose only sanitized info
  return new Response(
    JSON.stringify({
      bucket,
      endpointHost: endpoint ? (() => { try { return new URL(endpoint).host; } catch { return endpoint; } })() : null,
      region,
      forcePathStyle,
      hasAccessKeyId,
      hasSecretAccessKey,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

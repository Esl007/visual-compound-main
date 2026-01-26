import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage/b2";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 45000, ...rest } = opts as any;
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(rest as any), signal: ac.signal } as any);
  } finally {
    clearTimeout(id);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supa = supabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
    }
    const body = await req.json();
    const templateId: string | undefined = body?.templateId;
    const userPrompt: string | undefined = body?.prompt;
    const aspectRatio: string | undefined = body?.aspectRatio;
    const numImages: number = (() => {
      const n = Number(body?.numImages);
      if (!Number.isFinite(n)) return 1;
      return Math.max(1, Math.min(6, Math.floor(n)));
    })();

    if (!templateId) {
      return new Response(JSON.stringify({ error: "Missing templateId" }), { status: 400 });
    }

    const GOOGLE_API_KEY = (process.env.GOOGLE_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_API_KEY" }), { status: 500 });
    }

    const { data: trow } = await supa
      .from("templates")
      .select("original_image_path, background_image_path, product_prompt")
      .eq("id", templateId)
      .single();
    let origKey: string | null = null;
    const o = (trow as any)?.original_image_path || null;
    if (o && String(o).endsWith("original.png")) {
      origKey = o;
    } else {
      const b = (trow as any)?.background_image_path || null;
      if (b && !/(thumb_|preview)/.test(String(b))) {
        origKey = b;
      }
    }
    if (!origKey) {
      return new Response(JSON.stringify({ error: "Template has no original image" }), { status: 404 });
    }

    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) {
      return new Response(JSON.stringify({ error: "Missing S3_BUCKET" }), { status: 500 });
    }

    const signed = await getSignedUrl({ bucket, key: origKey, expiresInSeconds: 300 });
    const refRes = await fetchWithTimeout(signed, { method: "GET", cache: "no-store", timeoutMs: 20000 } as any);
    if (!refRes.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch original (${refRes.status})` }), { status: 502 });
    }
    const mime = refRes.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await refRes.arrayBuffer());
    const origInline = { inlineData: { mimeType: mime, data: buf.toString("base64") } } as const;

    const arSet = new Set(["1:1", "16:9", "9:16"]);
    const ar = arSet.has(aspectRatio || "") ? (aspectRatio as string) : "1:1";

    const combinedPrompt = (() => {
      const parts: string[] = [];
      if ((trow as any)?.product_prompt && String((trow as any).product_prompt).trim()) parts.push(String((trow as any).product_prompt).trim());
      if (userPrompt && String(userPrompt).trim()) parts.push(String(userPrompt).trim());
      return parts.join(" ");
    })();

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

    const target = numImages;
    const agg: Array<{ imageBase64: string; mimeType: string }> = [];
    let dbg: any = null;

    const attempt = async () => {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": GOOGLE_API_KEY },
        body: JSON.stringify({
          model: "gemini-2.5-flash-image",
          contents: [
            { role: "user", parts: [{ text: `${combinedPrompt || "Product visual"} (keep background consistent)` }, origInline] },
          ],
          generationConfig: { imageConfig: { aspectRatio: ar } },
          aspect: ar,
        }),
      } as any);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`gen failed: HTTP ${res.status} ${text}`);
      }
      const j = await res.json();
      const candidates = (j as any)?.candidates || [];
      const images: Array<{ imageBase64: string; mimeType: string }> = [];
      for (const c of candidates) {
        const parts = (c?.content?.parts || []) as any[];
        for (const p of parts) {
          if (p?.inlineData?.mimeType?.startsWith("image/")) {
            images.push({ imageBase64: String(p.inlineData.data), mimeType: String(p.inlineData.mimeType) });
          }
        }
      }
      if (!dbg) dbg = { endpoint: "template-generate", response: { candidatesCount: candidates.length } };
      return images;
    };

    // Aggregate to target count by calling multiple times if needed
    let guard = 0;
    while (agg.length < target && guard < 6) {
      const imgs = await attempt();
      for (const im of imgs) {
        if (agg.length >= target) break;
        agg.push(im);
      }
      guard++;
    }

    if (agg.length === 0) {
      return new Response(JSON.stringify({ error: "No image content returned" }), { status: 502 });
    }

    const payload: any = {
      images: agg,
      imageBase64: agg[0]?.imageBase64,
      mimeType: agg[0]?.mimeType || "image/png",
      debug: dbg,
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

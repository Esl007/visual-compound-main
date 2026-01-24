import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { uploadImage, cacheControlForKey, getSignedUrl } from "@/lib/storage/b2";
import { buildUserPath, extFromMime } from "@/lib/images/paths";
export const runtime = "nodejs";
export const maxDuration = 60;
function cleanEnv(v?: string) {
  if (!v) return v as any;
  let out = v.trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  return out;
}
// Abort long-running fetches to avoid hanging external calls
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shouldRetry = (e: any) => /(?:503|429|overloaded|temporarily|unavailable|rate)/i.test(String(e?.message || e));
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4) {
  let lastErr: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn(); } catch (e: any) {
      lastErr = e;
      if (!shouldRetry(e)) throw e;
      const delay = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await sleep(delay);
    }
  }
  throw lastErr;
}
export async function POST(req: NextRequest) {
  try {
    const supa = supabaseServer();
    const { data: { session } } = await supa.auth.getSession();
    const hasSession = Boolean(session);
    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    const productImageUrl: string | undefined = body?.productImageUrl;
    const productImageDataUrl: string | undefined = body?.productImageDataUrl;
    const productImageKey: string | undefined = body?.productImageKey;
    const keepBackground: boolean | undefined = body?.keepBackground;
    const aspectRatio: string | undefined = body?.aspectRatio;
    const imageSize: "1K" | "2K" | "4K" | undefined = body?.imageSize;
    let persist: boolean = Boolean(body?.persist) && hasSession;
    const templateId: string | undefined = body?.templateId;
    const templateMode = Boolean(templateId);
    const numImages: number = (() => {
      const n = Number(body?.numImages);
      if (!Number.isFinite(n)) return 1;
      return Math.max(1, Math.min(6, Math.floor(n)));
    })();
    const GOOGLE_API_KEY = cleanEnv(process.env.GOOGLE_API_KEY);
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_API_KEY" }), { status: 500 });
    }
    if (!prompt && !productImageUrl && !productImageDataUrl && !productImageKey && !templateId) {
      return new Response(JSON.stringify({ error: "Provide prompt or product image" }), { status: 400 });
    }
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    let templateImageDataUrl: string | null = null;
let templateProductPrompt: string | null = null;
let templateDebug: any = null;
if (templateId) {
  try {
    let trow: any = null;
    const r1 = await supa
      .from("templates")
      .select("original_image_path, background_image_path, background_prompt, product_prompt")
      .eq("id", templateId)
      .single();
    if ((r1 as any)?.error) {
      const r2 = await supa
        .from("templates")
        .select("background_image_path, background_prompt, product_prompt")
        .eq("id", templateId)
        .single();
      if (!(r2 as any)?.error) trow = (r2 as any).data || null;
      if (typeof templateDebug === 'object' && templateDebug) {
        templateDebug.selectFallback = true;
        templateDebug.selectError = (r1 as any).error?.message || String((r1 as any).error || 'select_error');
      } else {
        templateDebug = { selectFallback: true, selectError: (r1 as any).error?.message || String((r1 as any).error || 'select_error') };
      }
    } else {
      trow = (r1 as any).data || null;
    }
    const origKey: string | null = (trow as any)?.original_image_path || (trow as any)?.background_image_path || null;
    if (origKey) {
      const bucketT = process.env.S3_BUCKET as string;
      const signedBg = await getSignedUrl({ bucket: bucketT, key: origKey, expiresInSeconds: 300 });
      const resBg = await fetchWithTimeout(signedBg, { method: "GET", cache: "no-store", timeoutMs: 20000 } as any);
      if (resBg.ok) {
  const mime = resBg.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await resBg.arrayBuffer());
  templateImageDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  templateDebug = { origKey, mime };
} else {
  templateDebug = { origKey, errorStatus: resBg.status };
}
    }
    if (trow?.product_prompt) templateProductPrompt = String(trow.product_prompt);
  } catch {}
}

let inlineDataUrl: string | null = templateImageDataUrl || null;
if (!inlineDataUrl && !templateMode && productImageDataUrl) {
  inlineDataUrl = productImageDataUrl;
}
if (!inlineDataUrl && !templateMode && productImageKey) {
  try {
    const bucketK = process.env.S3_BUCKET as string;
    const signed = await getSignedUrl({ bucket: bucketK, key: productImageKey, expiresInSeconds: 60 });
    const refRes = await fetchWithTimeout(signed, { method: "GET", cache: "no-store", timeoutMs: 20000 } as any);
    if (refRes.ok) {
      const mime = refRes.headers.get("content-type") || "image/png";
      const buf = Buffer.from(await refRes.arrayBuffer());
      inlineDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch {}
}
const keepBg = templateId ? true : Boolean(keepBackground);
const combinedPrompt = (() => {
  const parts: string[] = [];
  if (templateProductPrompt && String(templateProductPrompt).trim()) parts.push(String(templateProductPrompt).trim());
  if (prompt && String(prompt).trim()) parts.push(String(prompt).trim());
  return parts.join(" ");
})();

    // Try primary Imagen 3 model name
    const tryGenerate = async (modelName: string) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      let imgPart: any = null;
      if (inlineDataUrl || (!templateMode && productImageUrl)) {
        const source = inlineDataUrl || (productImageUrl as string);
        if (source.startsWith("data:")) {
          const idx = source.indexOf(",");
          const meta = source.slice(5, idx);
          const data = source.slice(idx + 1);
          const mime = (meta.split(";")[0] || "image/png") as string;
          imgPart = { inlineData: { mimeType: mime, data } };
        } else {
          const refRes = await fetchWithTimeout(source, {
            method: "GET",
            headers: {
              "user-agent": "Mozilla/5.0 (compatible; VercelRuntime/1.0)",
              accept: "image/*,*/*;q=0.8",
            },
            redirect: "follow",
            cache: "no-store",
            timeoutMs: 20000,
          } as any);
          if (!refRes.ok) {
            const status = refRes.status;
            const ct = refRes.headers.get("content-type");
            throw new Error(`Failed to fetch product image: HTTP ${status} ct=${ct || "unknown"}`);
          }
          const mime = refRes.headers.get("content-type") || "image/png";
          const buf = Buffer.from(await refRes.arrayBuffer());
          imgPart = { inlineData: { mimeType: mime, data: buf.toString("base64") } };
        }
      }
      const arSet = new Set(["1:1", "16:9", "9:16"]);
      const ar = arSet.has(aspectRatio || "") ? (aspectRatio as string) : "1:1";
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${combinedPrompt || "Product visual"}${keepBg ? " (keep background consistent)" : ""}` },
              // Note: productImageUrl is not directly inlined due to SDK file API requirements.
              // This implementation focuses on text-to-image.
              ...(imgPart ? [imgPart] : []),
            ],
          },
        ],
        generationConfig: {
          imageConfig: { aspectRatio: ar }
        } as any,
      });
      const candidates = (result as any)?.response?.candidates || [];
      const images: Array<{ imageBase64: string; mimeType: string }> = [];
      for (const c of candidates) {
        const parts = (c?.content?.parts || []) as any[];
        for (const p of parts) {
          if (p?.inlineData?.mimeType?.startsWith("image/")) {
            images.push({ imageBase64: String(p.inlineData.data), mimeType: String(p.inlineData.mimeType) });
          }
        }
      }
      if (images.length > 0) {
        return { images, imageBase64: images[0].imageBase64, mimeType: images[0].mimeType } as any;
      }
      throw new Error("No image content returned by Google AI");
    };
    const tryGenerateRest = async () => {
      let imgPart: any = null;
      if (inlineDataUrl || (!templateMode && productImageUrl)) {
        const source = inlineDataUrl || (productImageUrl as string);
        if (source.startsWith("data:")) {
          const idx = source.indexOf(",");
          const meta = source.slice(5, idx);
          const data = source.slice(idx + 1);
          const mime = (meta.split(";")[0] || "image/png") as string;
          imgPart = { inlineData: { mimeType: mime, data } };
        } else {
          const refRes = await fetchWithTimeout(source, {
            method: "GET",
            headers: {
              "user-agent": "Mozilla/5.0 (compatible; VercelRuntime/1.0)",
              accept: "image/*,*/*;q=0.8",
            },
            redirect: "follow",
            cache: "no-store",
            timeoutMs: 20000,
          } as any);
          if (!refRes.ok) {
            const status = refRes.status;
            const ct = refRes.headers.get("content-type");
            throw new Error(`Failed to fetch product image: HTTP ${status} ct=${ct || "unknown"}`);
          }
          const mime = refRes.headers.get("content-type") || "image/png";
          const buf = Buffer.from(await refRes.arrayBuffer());
          imgPart = { inlineData: { mimeType: mime, data: buf.toString("base64") } };
        }
      }
      const arSet = new Set(["1:1", "16:9", "9:16"]);
      const ar = arSet.has(aspectRatio || "") ? (aspectRatio as string) : "1:1";
      const promptText = `${combinedPrompt || "Product visual"}${keepBg ? " (keep background consistent)" : ""}`;
      const debug: any = {
        endpoint: "generateContent:REST",
        request: {
          model: "gemini-2.5-flash-image",
          aspect: ar,
          promptPreview: (promptText || "").slice(0, 200),
          promptLength: (promptText || "").length,
          hasInlineImage: Boolean(imgPart),
          numberOfImages: numImages,
        },
        response: {},
      };
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash-image",
          contents: [
            {
              role: "user",
              parts: [
                { text: promptText },
                ...(imgPart ? [imgPart] : []),
              ],
            },
          ],
          generationConfig: {
            imageConfig: { aspectRatio: ar },
          },
          aspect: ar,
        }),
      } as any);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`REST generation failed: HTTP ${res.status} ${text}`);
      }
      const j = await res.json();
      const candidates = (j as any)?.candidates || [];
      debug.response.candidatesCount = candidates.length;
      const images: Array<{ imageBase64: string; mimeType: string }> = [];
      for (const c of candidates) {
        const parts = (c?.content?.parts || []) as any[];
        for (const p of parts) {
          if (p?.inlineData?.mimeType?.startsWith("image/")) {
            images.push({ imageBase64: String(p.inlineData.data), mimeType: String(p.inlineData.mimeType) });
          }
        }
      }
      debug.response.imagesCount = images.length;
      if (images.length > 0) {
        return { images, imageBase64: images[0].imageBase64, mimeType: images[0].mimeType, debug } as any;
      }
      // Surface any text returned for debugging
      let textSnippet = "";
      for (const c of candidates) {
        const parts = (c?.content?.parts || []) as any[];
        for (const p of parts) {
          if (typeof p?.text === "string" && p.text) {
            textSnippet = p.text.slice(0, 300);
            break;
          }
        }
        if (textSnippet) break;
      }
      if (textSnippet) {
        throw new Error(`No image content returned by REST endpoint; text snippet: ${textSnippet}`);
      }
      throw new Error("No image content returned by REST endpoint");
    };
    const tryGenerateImagesApi = async () => {
      const arSet = new Set(["1:1", "16:9", "9:16"]);
      const ar = arSet.has(aspectRatio || "") ? (aspectRatio as string) : "1:1";
      const promptText = `${combinedPrompt || "Product visual"}${keepBg ? " (keep background consistent)" : ""}`;
      const url = "https://generativelanguage.googleapis.com/v1beta/images:generate";
      const attempt = async (modelId: string) => {
        const debug: any = {
          endpoint: "images:generate",
          request: {
            model: modelId,
            aspect: ar,
            promptPreview: (promptText || "").slice(0, 200),
            promptLength: (promptText || "").length,
            hasInlineImage: false,
            numberOfImages: numImages,
          },
          response: {},
        };
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": GOOGLE_API_KEY,
          },
          body: JSON.stringify({
            model: modelId,
            // Common shapes used across Google samples; include both for compatibility
            prompt: { text: promptText },
            imageGenerationConfig: { aspectRatio: ar, numberOfImages: numImages, outputMimeType: "image/png" },
            aspect: ar,
          }),
        } as any);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`images:generate failed: HTTP ${res.status} ${text}`);
        }
        const j = await res.json();
        const imgs = (j as any)?.images || (j as any)?.generatedImages || [];
        const images: Array<{ imageBase64: string; mimeType: string }> = [];
        if (Array.isArray(imgs)) {
          for (const im of imgs) {
            const inline = im?.inlineData || im?.inline_data || im?.image || im;
            const data = inline?.data || inline?.bytesBase64 || inline?.base64;
            const mime = inline?.mimeType || inline?.mime || "image/png";
            if (data && String(mime).startsWith("image/")) {
              images.push({ imageBase64: String(data), mimeType: String(mime) });
            }
          }
        }
        debug.response.imagesCount = images.length;
        if (images.length > 0) {
          return { images, imageBase64: images[0].imageBase64, mimeType: images[0].mimeType, debug } as any;
        }
        // Fallback: check candidates form just in case
        const candidates = (j as any)?.candidates || [];
        debug.response.candidatesCount = candidates.length;
        for (const c of candidates) {
          const parts = (c?.content?.parts || []) as any[];
          for (const p of parts) {
            if (p?.inlineData?.mimeType?.startsWith("image/")) {
              images.push({ imageBase64: String(p.inlineData.data), mimeType: String(p.inlineData.mimeType) });
            }
          }
        }
        if (images.length > 0) {
          return { images, imageBase64: images[0].imageBase64, mimeType: images[0].mimeType, debug } as any;
        }
        // Surface any prompt feedback or returned text for debugging
        let textSnippet = "";
        for (const c of candidates) {
          const parts = (c?.content?.parts || []) as any[];
          for (const p of parts) {
            if (typeof p?.text === "string" && p.text) {
              textSnippet = p.text.slice(0, 300);
              break;
            }
          }
          if (textSnippet) break;
        }
        const pf = (j as any)?.promptFeedback || (j as any)?.safetyFeedback;
        const pfSnippet = pf ? JSON.stringify(pf).slice(0, 300) : "";
        if (textSnippet || pfSnippet) {
          throw new Error(
            `images:generate response contained no image data; text snippet: ${textSnippet || "<none>"}; feedback: ${pfSnippet || "<none>"}`,
          );
        }
        throw new Error("images:generate response contained no image data");
      };
      // Try both forms of model identifier for compatibility
      try {
        return await withRetry(() => attempt("gemini-2.5-flash-image"), 4);
      } catch (_) {
        return await withRetry(() => attempt("models/gemini-2.5-flash-image"), 4);
      }
    };
    const hasGuidance = Boolean(inlineDataUrl || (!templateMode && productImageUrl));
    const userId = session?.user?.id || null;
    const bucket = process.env.S3_BUCKET as string;
    async function persistImages(images: Array<{ imageBase64: string; mimeType: string }>) {
      if (!images || images.length === 0) return null;
      if (!persist) return null;
      if (!userId) return null;
      const stored: Array<{ id: string; storage_path: string; signed_url: string; mimeType: string }> = [];
      for (const im of images) {
        const mime = im.mimeType || "image/png";
        const buf = Buffer.from(im.imageBase64, "base64");
        const ext = extFromMime(mime);
        const { id, key } = buildUserPath(userId, undefined, ext);
        await uploadImage({ bucket, key, body: buf, contentType: mime, cacheControl: cacheControlForKey(key) });
        const { error: dbErr } = await supa.from("images").insert({ id, user_id: userId, type: "user", storage_path: key, metadata: {} });
        if (dbErr) {
          console.warn("images insert failed; continuing without DB row:", (dbErr as any)?.message || dbErr);
        }
        const signed_url = await getSignedUrl({ bucket, key, expiresInSeconds: 300 });
        stored.push({ id, storage_path: key, signed_url, mimeType: mime });
      }
      return stored;
    }
    if (hasGuidance) {
      try {
        // Guided: use generateContent REST so we can inline the product image
        // If multiple images requested, call endpoint repeatedly and aggregate
        const target = numImages;
        const agg: Array<{ imageBase64: string; mimeType: string }> = [];
        let dbg: any = null;
const batch = Math.min(2, Math.max(1, target));
let guard = 0;
while (agg.length < target && guard < 6) {
  const need = target - agg.length;
  const toLaunch = Math.min(batch, need);
  const outs = await Promise.all(Array.from({ length: toLaunch }).map(() => withRetry(() => tryGenerateRest(), 4)));
  for (const out of outs as any[]) {
    if (!dbg && out?.debug) dbg = out.debug;
    const imgs: Array<{ imageBase64: string; mimeType: string }> = Array.isArray(out?.images)
      ? out.images
      : out?.imageBase64
      ? [{ imageBase64: out.imageBase64, mimeType: out?.mimeType || "image/png" }]
      : [];
    for (const im of imgs) {
      if (agg.length >= target) break;
      agg.push(im);
    }
    if (agg.length >= target) break;
  }
  guard++;
}
if (dbg) {
          dbg.response = { ...(dbg.response || {}), imagesCount: agg.length };
        if (templateDebug) { dbg = { ...(dbg || {}), template: templateDebug }; }
        }
        const stored = persist ? await persistImages(agg) : null;
          const payload: any = {
          images: agg,
          imageBase64: agg[0]?.imageBase64,
          mimeType: agg[0]?.mimeType || "image/png",
          stored: stored,
            debug: dbg,
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (e1: any) {
        try {
          // Fallback to images:generate (prompt-only)
          const out2 = await tryGenerateImagesApi();
          const imgs2 = Array.isArray((out2 as any)?.images) ? (out2 as any).images : [];
          const stored2 = persist ? await persistImages(imgs2) : null;
          return new Response(JSON.stringify({ ...out2, stored: stored2 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e2: any) {
          try {
            // Last resort: SDK with aggregation to honor numImages
            const arSet = new Set(["1:1", "16:9", "9:16"]);
            const ar = arSet.has(aspectRatio || "") ? (aspectRatio as string) : "1:1";
            const promptText = `${combinedPrompt || "Product visual"}${keepBg ? " (keep background consistent)" : ""}`;
            const target = numImages;
            const agg: Array<{ imageBase64: string; mimeType: string }> = [];
            for (let i = 0; i < target; i++) {
              const outCore = (await tryGenerate("gemini-2.5-flash-image")) as any;
              const imgs: Array<{ imageBase64: string; mimeType: string }> = Array.isArray(outCore?.images)
                ? outCore.images
                : outCore?.imageBase64
                ? [{ imageBase64: outCore.imageBase64, mimeType: outCore?.mimeType || "image/png" }]
                : [];
              for (const im of imgs) {
                if (agg.length >= target) break;
                agg.push(im);
              }
            }
            const out3 = {
              images: agg,
              imageBase64: agg[0]?.imageBase64,
              mimeType: agg[0]?.mimeType || "image/png",
              debug: {
                endpoint: "sdk-generateContent",
                request: {
                  model: "gemini-2.5-flash-image",
                  aspect: ar,
                  promptPreview: (promptText || "").slice(0, 200),
                  promptLength: (promptText || "").length,
                  hasInlineImage: true,
                  numberOfImages: numImages,
                },
                response: { imagesCount: agg.length },
              },
            } as any;
            const stored3 = persist ? await persistImages(agg) : null;
            return new Response(JSON.stringify({ ...out3, stored: stored3 }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          } catch (e3: any) {
            return new Response(
              JSON.stringify({
                error: "Google AI image generation failed",
                detail: e3?.message || e2?.message || e1?.message,
                model: "gemini-2.5-flash-image",
              }),
              { status: 500 },
            );
          }
        }
      }
    } else {
      try {
        // Prompt-only: prefer direct images:generate to force image output
        const out = await tryGenerateImagesApi();
        const imgs = Array.isArray((out as any)?.images) ? (out as any).images : [];
        const stored = persist ? await persistImages(imgs) : null;
        return new Response(JSON.stringify({ ...out, stored }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (e1: any) {
        try {
          // Next: REST generateContent with aspect; aggregate to numImages if needed
          const target = numImages;
          const agg: Array<{ imageBase64: string; mimeType: string }> = [];
          let dbg: any = null;
const batch = Math.min(2, Math.max(1, target));
let guard = 0;
while (agg.length < target && guard < 6) {
  const need = target - agg.length;
  const toLaunch = Math.min(batch, need);
  const outs = await Promise.all(Array.from({ length: toLaunch }).map(() => withRetry(() => tryGenerateRest(), 4)));
  for (const out of outs as any[]) {
    if (!dbg && out?.debug) dbg = out.debug;
    const imgs: Array<{ imageBase64: string; mimeType: string }> = Array.isArray(out?.images)
      ? out.images
      : out?.imageBase64
      ? [{ imageBase64: out.imageBase64, mimeType: out?.mimeType || "image/png" }]
      : [];
    for (const im of imgs) {
      if (agg.length >= target) break;
      agg.push(im);
    }
    if (agg.length >= target) break;
  }
  guard++;
}
if (dbg) dbg.response = { ...(dbg.response || {}), imagesCount: agg.length };
        if (templateDebug) { dbg = { ...(dbg || {}), template: templateDebug }; }
          const payload: any = {
            images: agg,
            imageBase64: agg[0]?.imageBase64,
            mimeType: agg[0]?.mimeType || "image/png",
            debug: dbg,
          };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e2: any) {
          try {
            // Last resort: SDK; aggregate to numImages
            const arSet = new Set(["1:1", "16:9", "9:16"]);
            const ar = arSet.has(aspectRatio || "") ? (aspectRatio as string) : "1:1";
            const promptText = `${combinedPrompt || "Product visual"}${keepBg ? " (keep background consistent)" : ""}`;
            const target = numImages;
            const agg: Array<{ imageBase64: string; mimeType: string }> = [];
            for (let i = 0; i < target; i++) {
              const outCore = (await tryGenerate("gemini-2.5-flash-image")) as any;
              const imgs: Array<{ imageBase64: string; mimeType: string }> = Array.isArray(outCore?.images)
                ? outCore.images
                : outCore?.imageBase64
                ? [{ imageBase64: outCore.imageBase64, mimeType: outCore?.mimeType || "image/png" }]
                : [];
              for (const im of imgs) {
                if (agg.length >= target) break;
                agg.push(im);
              }
            }
            const out3 = {
              images: agg,
              imageBase64: agg[0]?.imageBase64,
              mimeType: agg[0]?.mimeType || "image/png",
              debug: {
                endpoint: "sdk-generateContent",
                request: {
                  model: "gemini-2.5-flash-image",
                  aspect: ar,
                  promptPreview: (promptText || "").slice(0, 200),
                  promptLength: (promptText || "").length,
                  hasInlineImage: false,
                  numberOfImages: numImages,
                },
                response: { imagesCount: agg.length },
              },
            } as any;
            const stored3 = persist ? await persistImages(agg) : null;
            return new Response(JSON.stringify({ ...out3, stored: stored3 }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          } catch (e3: any) {
            return new Response(
              JSON.stringify({
                error: "Google AI image generation failed",
                detail: e3?.message || e2?.message || e1?.message,
                model: "gemini-2.5-flash-image",
              }),
              { status: 500 },
            );
          }
        }
      }
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

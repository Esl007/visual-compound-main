import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    const productImageUrl: string | undefined = body?.productImageUrl;
    const productImageDataUrl: string | undefined = body?.productImageDataUrl;
    const keepBackground: boolean | undefined = body?.keepBackground;
    const aspectRatio: string | undefined = body?.aspectRatio;
    const imageSize: "1K" | "2K" | "4K" | undefined = body?.imageSize;

    const GOOGLE_API_KEY = cleanEnv(process.env.GOOGLE_API_KEY);
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_API_KEY" }), { status: 500 });
    }
    if (!prompt && !productImageUrl) {
      return new Response(JSON.stringify({ error: "Provide prompt or productImageUrl" }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    // Try primary Imagen 3 model name
    const tryGenerate = async (modelName: string) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      let imgPart: any = null;
      if (productImageDataUrl || productImageUrl) {
        const source = productImageDataUrl || productImageUrl!;
        if (source.startsWith("data:")) {
          const idx = source.indexOf(",");
          const meta = source.slice(5, idx);
          const data = source.slice(idx + 1);
          const mime = (meta.split(";")[0] || "image/png") as string;
          imgPart = { inlineData: { mimeType: mime, data } };
        } else {
          const refRes = await fetch(source, {
            method: "GET",
            headers: {
              "user-agent": "Mozilla/5.0 (compatible; VercelRuntime/1.0)",
              accept: "image/*,*/*;q=0.8",
            },
            redirect: "follow",
            cache: "no-store",
          } as RequestInit);
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
              { text: `${prompt || "Product visual"}${keepBackground ? " (keep background consistent)" : ""}` },
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

      // Walk candidates -> parts -> inlineData
      const candidates = (result as any)?.response?.candidates || [];
      for (const c of candidates) {
        const parts = (c?.content?.parts || []) as any[];
        for (const p of parts) {
          if (p?.inlineData?.mimeType?.startsWith("image/")) {
            return {
              imageBase64: p.inlineData.data as string,
              mimeType: p.inlineData.mimeType as string,
            };
          }
        }
      }
      throw new Error("No image content returned by Google AI");
    };

    try {
      const out = await tryGenerate("gemini-2.5-flash-image");
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (e1: any) {
      try {
        const out2 = await tryGenerate("gemini-2.5-flash-image");
        return new Response(JSON.stringify(out2), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (e2: any) {
        const key = cleanEnv(process.env.GOOGLE_API_KEY) || "";
        const keyPrefix = key ? key.slice(0, 6) : "";
        return new Response(
          JSON.stringify({
            error: "Google AI image generation failed",
            detail: e2?.message || e1?.message,
            model: "gemini-2.5-flash-image",
            env: {
              googleApiKeyPrefix: keyPrefix,
              hasKey: Boolean(key),
            },
          }),
          { status: 500 },
        );
      }
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Bad Request" }), { status: 400 });
  }
}

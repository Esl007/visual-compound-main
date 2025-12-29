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
      if (productImageUrl) {
        const refRes = await fetch(productImageUrl);
        if (!refRes.ok) {
          throw new Error("Failed to fetch productImageUrl");
        }
        const mime = refRes.headers.get("content-type") || "image/png";
        const buf = Buffer.from(await refRes.arrayBuffer());
        imgPart = { inlineData: { mimeType: mime, data: buf.toString("base64") } };
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
          responseMimeType: "image/png",
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

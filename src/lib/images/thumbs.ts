import sharp from "sharp";
import { uploadImage, cacheControlForKey } from "@/lib/storage/b2";

export async function reencodeToPng(input: Buffer): Promise<Buffer> {
  return await sharp(input).png({ quality: 90 }).toBuffer();
}

export async function generateAndUploadThumbnails(opts: {
  input: Buffer;
  bucket: string;
  outputBasePath: string; // e.g. templates/{templateId}
}) {
  const sizes = [400, 600];
  const out: { size: number; path: string }[] = [];
  for (const size of sizes) {
    const webp = await sharp(opts.input)
      .resize(size, size, { fit: "cover", position: "centre" as any })
      .webp({ quality: 82 })
      .toBuffer();
    const path = `${opts.outputBasePath}/thumb_${size}.webp`;
    await uploadImage({
      bucket: opts.bucket,
      key: path,
      body: webp,
      contentType: "image/webp",
      cacheControl: cacheControlForKey(path),
    });
    out.push({ size, path });
  }
  return out;
}

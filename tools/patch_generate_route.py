import re
from pathlib import Path

p = Path('app/api/generate/route.ts')
src = p.read_text()
orig = src
changed = False

# 1) Ensure templateMode exists after templateId declaration
if 'const templateMode = Boolean(templateId);' not in src:
    src, n = re.subn(r"(const templateId: [^;]+;)", r"\1\n    const templateMode = Boolean(templateId);", src, count=1)
    if n:
        changed = True

# 2) Prefer original_image_path when loading template
src2, n = re.subn(r"\.select\(\"background_image_path, background_prompt, product_prompt\"\)",
                 '.select("original_image_path, background_image_path, background_prompt, product_prompt")', src, count=1)
if n:
    src = src2
    changed = True

if 'trow?.background_image_path' in src:
    src = src.replace(
        'if (trow?.background_image_path) {',
        'const origKey: string | null = (trow as any)?.original_image_path || (trow as any)?.background_image_path || null;\n    if (origKey) {'
    )
    src = src.replace('trow.background_image_path', 'origKey')
    changed = True

# 3) Replace broken inlineDataUrl block with a clean, gated version
start_marker = 'let inlineDataUrl: string | null'
keepbg_marker = 'const keepBg ='
si = src.find(start_marker)
ki = src.find(keepbg_marker, si if si != -1 else 0)
if si != -1 and ki != -1:
    replacement = (
        'let inlineDataUrl: string | null = templateImageDataUrl || null;\n'
        'if (!inlineDataUrl && !templateMode && productImageDataUrl) {\n'
        '  inlineDataUrl = productImageDataUrl;\n'
        '}\n'
        'if (!inlineDataUrl && !templateMode && productImageKey) {\n'
        '  try {\n'
        '    const bucketK = process.env.S3_BUCKET as string;\n'
        '    const signed = await getSignedUrl({ bucket: bucketK, key: productImageKey, expiresInSeconds: 60 });\n'
        '    const refRes = await fetchWithTimeout(signed, { method: "GET", cache: "no-store", timeoutMs: 20000 } as any);\n'
        '    if (refRes.ok) {\n'
        '      const mime = refRes.headers.get("content-type") || "image/png";\n'
        '      const buf = Buffer.from(await refRes.arrayBuffer());\n'
        '      inlineDataUrl = `data:${mime};base64,${buf.toString("base64")}`;\n'
        '    }\n'
        '  } catch {}\n'
        '}\n'
        'const keepBg = templateId ? true : Boolean(keepBackground);\n'
    )
    src = src[:si] + replacement + src[ki+len(keepbg_marker):]
    changed = True

# 4) Normalize any corrupted conditionals referencing productImageUrl
# Replace broken variations of the if condition with gated version
src = re.sub(r"if\s*\(\s*inlineDataUrl[\s\S]*?productImageUrl[\s\S]*?\)\s*\{",
             'if (inlineDataUrl || (!templateMode && productImageUrl)) {', src)
# Fix the source assignment to cast productImageUrl string
src = src.replace('const source = inlineDataUrl || productImageUrl!',
                  'const source = inlineDataUrl || (productImageUrl as string)')

# 5) Fix hasGuidance line
src = re.sub(r"const hasGuidance\s*=\s*[^;]+;",
             'const hasGuidance = Boolean(inlineDataUrl || (!templateMode && productImageUrl));', src, count=1)

if src != orig:
    p.write_text(src)
    print('Patched app/api/generate/route.ts')
else:
    print('No changes needed for app/api/generate/route.ts')

import re
from pathlib import Path

p = Path('app/api/generate/route.ts')
src = p.read_text()
orig = src

# 1) Ensure templateDebug variable exists after templateProductPrompt
pattern_tp = re.compile(r"(let\s+templateProductPrompt\s*:\s*string\s*\|\s*null\s*=\s*null;)")
if pattern_tp.search(src):
    src = pattern_tp.sub(r"\1\nlet templateDebug: any = null;", src, count=1)

# 2) Replace fetch(signedBg) with fetchWithTimeout(...)
src = src.replace(
    "const resBg = await fetch(signedBg);",
    'const resBg = await fetchWithTimeout(signedBg, { method: "GET", cache: "no-store", timeoutMs: 20000 } as any);'
)

# 3) Replace the inner block to include MIME and templateDebug
src = re.sub(
    r"if \(resBg\.ok\) \{\s*const buf = Buffer\.from\(await resBg\.arrayBuffer\(\)\);\s*templateImageDataUrl = `data:image/png;base64,\$\{buf\.toString\(\"base64\"\)\}`;\s*\}",
    'if (resBg.ok) {\n  const mime = resBg.headers.get("content-type") || "image/png";\n  const buf = Buffer.from(await resBg.arrayBuffer());\n  templateImageDataUrl = `data:${mime};base64,${buf.toString("base64")}`;\n  templateDebug = { origKey, mime };\n} else {\n  templateDebug = { origKey, errorStatus: resBg.status };\n}',
    src,
    count=1,
    flags=re.S
)

# 4) Attach templateDebug to dbg in guided path if present
src = src.replace(
    "dbg.response = { ...(dbg.response || {}), imagesCount: agg.length };",
    'dbg.response = { ...(dbg.response || {}), imagesCount: agg.length };\n        if (templateDebug) { dbg = { ...(dbg || {}), template: templateDebug }; }'
)

if src != orig:
    p.write_text(src)
    print('Patched template background fetch and debug in generate route')
else:
    print('No changes applied by patch_template_bg_fetch')

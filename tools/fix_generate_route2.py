import re
from pathlib import Path

p = Path('app/api/generate/route.ts')
src = p.read_text()
orig = src

# Normalize keepBg to a single clean assignment
src = re.sub(r"const keepBg\s*=\s*[^;]+;", 'const keepBg = templateId ? true : Boolean(keepBackground);', src, count=1)
# Remove any stray duplicate line that may have been injected
src = src.replace('\n templateId ? true : Boolean(keepBackground);', '')
# Remove line with just a semicolon that may remain after broken edits
src = src.replace('\n;\n', '\n')

# Fix hasGuidance corruption: replace the whole line with a clean gated version
src = re.sub(r"const hasGuidance\s*=.*\n", 'const hasGuidance = Boolean(inlineDataUrl || (!templateMode && productImageUrl));\n', src, count=1)

if src != orig:
    p.write_text(src)
    print('Fixed keepBg and hasGuidance in generate route')
else:
    print('No changes needed by fix_generate_route2')

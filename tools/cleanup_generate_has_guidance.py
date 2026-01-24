import re
from pathlib import Path

p = Path('app/api/generate/route.ts')
s = p.read_text()
o = s

# Remove stray duplicate keepBg line variants
s = re.sub(r"\n\s*templateId \? true : Boolean\(keepBackground\);", "", s)
# Ensure single clean keepBg assignment
s = re.sub(r"const keepBg\s*=\s*[^;]+;", 'const keepBg = templateId ? true : Boolean(keepBackground);', s, count=1)

# Remove any existing hasGuidance lines (and any garbage trailing on the same line)
s = re.sub(r"\n\s*const hasGuidance\s*=.*\n", "\n", s)

# Insert correct hasGuidance before userId assignment
s = s.replace(
    "const userId = session?.user?.id || null;",
    'const hasGuidance = Boolean(inlineDataUrl || (!templateMode && productImageUrl));\n    const userId = session?.user?.id || null;'
)

if s != o:
    p.write_text(s)
    print('Cleaned hasGuidance and keepBg in generate route')
else:
    print('No changes needed by cleanup_generate_has_guidance')

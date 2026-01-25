import re
from pathlib import Path

p = Path('app/api/generate/route.ts')
s = p.read_text()
o = s

# Replace the templateId fetch block to include fallback selection
pattern = re.compile(r"if \(templateId\) \{\n\s*try \{\n\s*const \{ data: trow \} = await supa\n\s*\.from\(\"templates\"\)\n\s*\.select\(\"original_image_path, background_image_path, background_prompt, product_prompt\"\)\n\s*\.eq\(\"id\", templateId\)\n\s*\.single\(\);\n", re.S)

replacement = (
    "if (templateId) {\n  try {\n    let trow: any = null;\n    const r1 = await supa\n      .from(\"templates\")\n      .select(\"original_image_path, background_image_path, background_prompt, product_prompt\")\n      .eq(\"id\", templateId)\n      .single();\n    if ((r1 as any)?.error) {\n      const r2 = await supa\n        .from(\"templates\")\n        .select(\"background_image_path, background_prompt, product_prompt\")\n        .eq(\"id\", templateId)\n        .single();\n      if (!(r2 as any)?.error) trow = (r2 as any).data || null;\n      if (typeof templateDebug === 'object' && templateDebug) {\n        templateDebug.selectFallback = true;\n        templateDebug.selectError = (r1 as any).error?.message || String((r1 as any).error || 'select_error');\n      } else {\n        templateDebug = { selectFallback: true, selectError: (r1 as any).error?.message || String((r1 as any).error || 'select_error') };\n      }\n    } else {\n      trow = (r1 as any).data || null;\n    }\n"
)

if pattern.search(s):
    s = pattern.sub(replacement, s, count=1)

# Ensure closing remains intact; do not alter rest of block

if s != o:
    p.write_text(s)
    print('Added Supabase select fallback for templates in generate route')
else:
    print('No changes needed by patch_generate_template_query_fallback')

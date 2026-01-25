from pathlib import Path

p = Path('app/api/generate/route.ts')
text = p.read_text()
lines = text.splitlines()

# Remove stray duplicate keepBg fragments and lone semicolon lines
cleaned = []
for ln in lines:
    if ln.strip() == ';':
        continue
    if ln.strip() == 'templateId ? true : Boolean(keepBackground);':
        continue
    cleaned.append(ln)

# Remove any existing hasGuidance lines entirely
cleaned2 = [ln for ln in cleaned if 'const hasGuidance' not in ln]

# Find insertion point before userId
idx = 0
for i, ln in enumerate(cleaned2):
    if 'const userId = session?.user?.id' in ln:
        idx = i
        break

has_guidance = '    const hasGuidance = Boolean(inlineDataUrl || (!templateMode && productImageUrl));'
if idx:
    cleaned2.insert(idx, has_guidance)
else:
    # Fallback: append near top after inlineDataUrl/keepBg setup
    cleaned2.append(has_guidance)

out = '\n'.join(cleaned2) + ('\n' if not cleaned2[-1].endswith('\n') else '')
p.write_text(out)
print('Finalized generate route cleanup')

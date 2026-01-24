IMAGE GOVERNANCE RULES
---------------------
1. UI may only access thumbnails
2. Originals are resolved server-side only
3. Routes pass IDs, never assets
4. AI endpoints never accept client images for templates
5. Storage paths are immutable

STORAGE (Backblaze B2)
- Bucket: b2://visual-compound/
- Structure:
  templates/
    originals/
      template_<uuid>.png
    thumbnails/
      template_<uuid>_thumb.webp
- Originals are never resized; thumbnails are aggressively optimized
- Filenames are immutable; thumbnails can be public; originals are private/signed

DATABASE (Supabase)
- templates table stores paths only (no blobs/base64)
- Required: original_image_path, thumbnail paths

ACCESS CONTROL
- UI layer: only thumbnail URLs
- Server layer: can access originals; generates short-lived signed URLs (5–10 min) for AI use only

DATA FLOW
- Templates page: { id, name, thumbnailUrl }
- Click: router.push(`/generate?templateId=${id}`)
- Generate server page resolves template by id; UI never sees original URL
- AI API accepts only { templateId, userPrompt? } and resolves original server-side

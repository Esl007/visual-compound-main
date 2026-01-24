alter table if exists public.templates
  add column if not exists original_image_path text null;

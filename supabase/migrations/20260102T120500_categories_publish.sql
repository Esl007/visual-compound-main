-- Create categories table
create table if not exists public.template_categories (
  id uuid primary key,
  name text unique not null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

-- RLS for categories: readable by everyone
alter table public.template_categories enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'template_categories' AND policyname = 'select_all_categories'
  ) THEN
    create policy select_all_categories on public.template_categories
    for select using (true);
  END IF;
END $$;

-- Extend templates table for category_id and publish metadata
alter table public.templates
  add column if not exists category_id uuid null references public.template_categories(id),
  add column if not exists created_by uuid null references auth.users(id),
  add column if not exists published_at timestamptz null;

create index if not exists templates_category_id_idx on public.templates(category_id);

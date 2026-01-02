create table if not exists public.templates (
  id uuid primary key,
  title text not null,
  category text not null,
  background_prompt text null,
  product_prompt text null,
  background_image_path text null,
  preview_image_path text null,
  thumbnail_400_path text null,
  thumbnail_600_path text null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_status_idx on public.templates(status);
create index if not exists templates_featured_idx on public.templates(featured);
create index if not exists templates_created_at_idx on public.templates(created_at desc);

alter table public.templates enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'templates' and policyname = 'select_published'
  ) then
    create policy select_published on public.templates
    for select using (status = 'published');
  end if;
end $$;

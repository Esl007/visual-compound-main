-- Ensure pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Assets table: stores image metadata and URL in Backblaze B2
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  type text,
  width integer,
  height integer,
  prompt_hash text,
  created_at timestamptz not null default now()
);

-- Index for quick filtering by user and recency
create index if not exists assets_user_created_idx on public.assets(user_id, created_at desc);

-- Enable RLS
alter table public.assets enable row level security;

-- Policies: owner can select/insert/update; no delete by default
drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
  on public.assets
  for select
  using (auth.uid() = user_id);

drop policy if exists "assets_insert_own" on public.assets;
create policy "assets_insert_own"
  on public.assets
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "assets_update_own" on public.assets;
create policy "assets_update_own"
  on public.assets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

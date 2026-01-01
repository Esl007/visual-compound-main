-- images table
create table if not exists public.images (
  id uuid primary key,
  user_id uuid null references auth.users(id) on delete set null,
  type text not null check (type in ('template','user')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint images_user_presence check (
    (type = 'template' and user_id is null) or (type = 'user' and user_id is not null)
  )
);

create unique index if not exists images_storage_path_key on public.images(storage_path);
create index if not exists images_user_id_idx on public.images(user_id);

alter table public.images enable row level security;

-- SELECT policy: templates visible to all, users see their own
create policy if not exists select_own_and_templates
on public.images
for select
using (
  type = 'template' or user_id = auth.uid()
);

-- INSERT policy for user images (optional; server may use service role)
create policy if not exists insert_own_user_images
on public.images
for insert
with check (
  type = 'user' and user_id = auth.uid()
);

-- DELETE own user images
create policy if not exists delete_own_user_images
on public.images
for delete
using (
  user_id = auth.uid()
);

-- Profiles table linked to auth.users
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text default 'free',
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Assets table indexing Backblaze image URLs
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  url text not null,
  width int,
  height int,
  prompt_hash text,
  created_at timestamp with time zone default now()
);

alter table public.assets enable row level security;

drop policy if exists "Users insert own assets" on public.assets;
create policy "Users insert own assets"
  on public.assets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users read own assets" on public.assets;
create policy "Users read own assets"
  on public.assets for select
  using (auth.uid() = user_id);

-- Trigger to create profile row for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

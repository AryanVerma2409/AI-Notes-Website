-- Run this script once in your Supabase Dashboard -> SQL Editor
-- It creates the profiles, categories, and notes tables with Row Level Security (RLS)
-- so your AI Notes sync across all computers and browsers.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar_url text not null default '/src/assets/images/user_avatar_portrait_1795152808598.jpg',
  theme_preference text not null default 'light',
  cloud_provider text not null default 'AI Notes Cloud',
  cloud_bucket_name text not null default 'ainotes-cloud-vault',
  auto_sync boolean not null default true,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  accent_color text not null default '#2563EB',
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  word_count integer not null default 0,
  char_count integer not null default 0,
  sync_version integer not null default 1,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can manage own categories" on public.categories;
create policy "Users can manage own categories"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own notes" on public.notes;
create policy "Users can manage own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Smart Bookmark App: Supabase table + RLS
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Create bookmarks table
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  created_at timestamptz not null default now()
);

-- 2. Index for fast lookups by user
create index if not exists bookmarks_user_id_idx on public.bookmarks (user_id);

-- 3. Enable Row Level Security (bookmarks private per user)
alter table public.bookmarks enable row level security;

-- 4. Drop existing policies if you re-run this script (optional)
-- drop policy if exists "Users can view own bookmarks" on public.bookmarks;
-- drop policy if exists "Users can insert own bookmarks" on public.bookmarks;
-- drop policy if exists "Users can delete own bookmarks" on public.bookmarks;

-- 5. RLS policies: users can only see and change their own rows
create policy "Users can view own bookmarks"
  on public.bookmarks for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);

-- Done. Enable Realtime for this table: Database → Replication → turn on "bookmarks".

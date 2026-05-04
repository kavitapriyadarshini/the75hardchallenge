-- Run in Supabase SQL Editor after reviewing.
-- Table: attempts (one row per 75 Hard attempt per user)

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number integer not null,
  start_date date not null,
  ended_at date,
  created_at timestamptz not null default now(),
  unique (user_id, attempt_number)
);

create index attempts_user_id_idx on public.attempts (user_id);

grant select, insert, update, delete on table public.attempts to authenticated;

alter table public.attempts enable row level security;

create policy "attempts_select_own"
  on public.attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "attempts_insert_own"
  on public.attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "attempts_update_own"
  on public.attempts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

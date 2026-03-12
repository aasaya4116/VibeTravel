-- Create family vibe preferences table
create table if not exists public.family_vibes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  family_name text,
  kids jsonb default '[]',
  travel_style text[] default '{}',
  sensory_needs text[] default '{}',
  mobility_notes text,
  dietary text[] default '{}',
  pace text default 'moderate' check (pace in ('slow', 'moderate', 'fast')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

alter table public.family_vibes enable row level security;

create policy "family_vibes_select_own" on public.family_vibes
  for select using (auth.uid() = user_id);

create policy "family_vibes_insert_own" on public.family_vibes
  for insert with check (auth.uid() = user_id);

create policy "family_vibes_update_own" on public.family_vibes
  for update using (auth.uid() = user_id);

create policy "family_vibes_delete_own" on public.family_vibes
  for delete using (auth.uid() = user_id);

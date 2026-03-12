-- Create saved attractions table
create table if not exists public.saved_attractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attraction_name text not null,
  attraction_data jsonb not null,
  trip_id uuid references public.trips(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_id, attraction_name, trip_id)
);

alter table public.saved_attractions enable row level security;

create policy "saved_attractions_select_own" on public.saved_attractions
  for select using (auth.uid() = user_id);

create policy "saved_attractions_insert_own" on public.saved_attractions
  for insert with check (auth.uid() = user_id);

create policy "saved_attractions_update_own" on public.saved_attractions
  for update using (auth.uid() = user_id);

create policy "saved_attractions_delete_own" on public.saved_attractions
  for delete using (auth.uid() = user_id);

-- Owner-only booking, budget, and pre-trip readiness data.
-- This table is intentionally separate from trips so shared itineraries never
-- expose confirmation codes, private links, or costs.
create table if not exists public.trip_readiness (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  budget_target numeric(12, 2) check (budget_target is null or budget_target >= 0),
  bookings jsonb not null default '{}'::jsonb check (jsonb_typeof(bookings) = 'object'),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_readiness_user_id_idx
  on public.trip_readiness (user_id);

alter table public.trip_readiness enable row level security;

create policy "trip_readiness_select_own" on public.trip_readiness
  for select using (auth.uid() = user_id);

create policy "trip_readiness_insert_own" on public.trip_readiness
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trips
      where trips.id = trip_readiness.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "trip_readiness_update_own" on public.trip_readiness
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trips
      where trips.id = trip_readiness.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "trip_readiness_delete_own" on public.trip_readiness
  for delete using (auth.uid() = user_id);

-- Add budget_preference to family_vibes table
-- Run this in the Supabase SQL editor

alter table public.family_vibes
  add column if not exists budget_preference text default 'any'
    check (budget_preference in ('free', '$', '$$', '$$$', 'any'));

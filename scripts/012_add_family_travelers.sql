-- Support partners, grandparents, extended family, and other adult travelers.
-- Children remain in the existing kids column so current profiles and queries
-- continue to work without a data migration.
alter table public.family_vibes
  add column if not exists travelers jsonb not null default '[]'::jsonb;

comment on column public.family_vibes.travelers is
  'Non-child trip companions. Each item contains name, role, and optional age.';

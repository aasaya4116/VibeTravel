-- Harden row-level security and enforce trip ownership across related tables.
--
-- Run this migration in the Supabase SQL editor before running verify_rls.sql.
-- It is intentionally idempotent. The preflight aborts without changing data if
-- an existing row links one user's record to another user's trip.

begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(required_table order by required_table)
    into missing_tables
  from unnest(array[
    'public.profiles',
    'public.trips',
    'public.family_vibes',
    'public.saved_attractions',
    'public.chat_messages',
    'public.feedback_pulses',
    'public.feedback_outcomes',
    'public.feedback_messages',
    'public.trip_shares',
    'public.trip_readiness'
  ]) as required(required_table)
  where to_regclass(required_table) is null;

  if missing_tables is not null then
    raise exception
      'RLS hardening preflight failed. Apply the earlier schema migrations first. Missing: %',
      array_to_string(missing_tables, ', ');
  end if;

end
$$;

-- Keep the ownership preflight and trigger installation race-free. Reads
-- remain available while writes wait briefly for this transaction to finish.
lock table
  public.trips,
  public.saved_attractions,
  public.chat_messages,
  public.feedback_pulses,
  public.feedback_outcomes,
  public.trip_shares,
  public.trip_readiness
in share row exclusive mode;

do $$
declare
  violation_count bigint;
begin
  select count(*) into violation_count
  from public.saved_attractions child
  join public.trips trip on trip.id = child.trip_id
  where child.trip_id is not null
    and child.user_id is distinct from trip.user_id;
  if violation_count > 0 then
    raise exception 'RLS hardening preflight failed: saved_attractions has % cross-owner trip link(s).', violation_count;
  end if;

  select count(*) into violation_count
  from public.chat_messages child
  join public.trips trip on trip.id = child.trip_id
  where child.trip_id is not null
    and child.user_id is distinct from trip.user_id;
  if violation_count > 0 then
    raise exception 'RLS hardening preflight failed: chat_messages has % cross-owner trip link(s).', violation_count;
  end if;

  select count(*) into violation_count
  from public.feedback_pulses child
  join public.trips trip on trip.id = child.trip_id
  where child.trip_id is not null
    and child.user_id is distinct from trip.user_id;
  if violation_count > 0 then
    raise exception 'RLS hardening preflight failed: feedback_pulses has % cross-owner trip link(s).', violation_count;
  end if;

  select count(*) into violation_count
  from public.feedback_outcomes child
  join public.trips trip on trip.id = child.trip_id
  where child.trip_id is not null
    and child.user_id is distinct from trip.user_id;
  if violation_count > 0 then
    raise exception 'RLS hardening preflight failed: feedback_outcomes has % cross-owner trip link(s).', violation_count;
  end if;

  select count(*) into violation_count
  from public.trip_shares child
  join public.trips trip on trip.id = child.trip_id
  where child.created_by is distinct from trip.user_id;
  if violation_count > 0 then
    raise exception 'RLS hardening preflight failed: trip_shares has % cross-owner trip link(s).', violation_count;
  end if;

  select count(*) into violation_count
  from public.trip_readiness child
  join public.trips trip on trip.id = child.trip_id
  where child.user_id is distinct from trip.user_id;
  if violation_count > 0 then
    raise exception 'RLS hardening preflight failed: trip_readiness has % cross-owner trip link(s).', violation_count;
  end if;
end
$$;

-- RLS prevents cross-account access through the API. These triggers also
-- protect integrity when a privileged process writes to the tables directly.
create or replace function public.enforce_trip_owner_consistency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  linked_owner uuid;
  row_owner uuid;
begin
  if new.trip_id is null then
    return new;
  end if;

  row_owner := case
    when tg_table_name = 'trip_shares'
      then nullif(to_jsonb(new) ->> 'created_by', '')::uuid
    else nullif(to_jsonb(new) ->> 'user_id', '')::uuid
  end;

  select trip.user_id
    into linked_owner
  from public.trips trip
  where trip.id = new.trip_id;

  if linked_owner is null then
    raise exception using
      errcode = '23503',
      message = format('%I.trip_id does not reference an existing trip', tg_table_name);
  end if;

  if row_owner is null or row_owner is distinct from linked_owner then
    raise exception using
      errcode = '42501',
      message = format('%I.trip_id must belong to the same user', tg_table_name);
  end if;

  return new;
end;
$$;

alter function public.enforce_trip_owner_consistency() owner to postgres;
revoke all on function public.enforce_trip_owner_consistency() from public, anon, authenticated;

create or replace function public.prevent_trip_owner_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '42501',
      message = 'A trip cannot be transferred to another account';
  end if;
  return new;
end;
$$;

alter function public.prevent_trip_owner_change() owner to postgres;
revoke all on function public.prevent_trip_owner_change() from public, anon, authenticated;

-- Recreate the two pre-existing SECURITY DEFINER functions from reviewed
-- definitions. Merely changing their search_path would leave a compromised
-- owner or altered function body in place.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $handle_new_user$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$handle_new_user$;

alter function public.handle_new_user() owner to postgres;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.get_shared_trip(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $get_shared_trip$
  select jsonb_build_object(
    'trip', jsonb_build_object(
      'title', trips.title,
      'destination', trips.destination,
      'start_date', trips.start_date,
      'end_date', trips.end_date,
      'accommodation_area', trips.accommodation_area,
      'status', trips.status,
      'itinerary', coalesce(trips.itinerary, '[]'::jsonb)
    ),
    'shared_at', trip_shares.created_at
  )
  from public.trip_shares
  join public.trips
    on trips.id = trip_shares.trip_id
    and trips.user_id = trip_shares.created_by
  where trip_shares.token = p_token
    and trip_shares.revoked_at is null
  limit 1;
$get_shared_trip$;

alter function public.get_shared_trip(text) owner to postgres;
revoke all on function public.get_shared_trip(text) from public, anon, authenticated;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- SECURITY DEFINER functions reference objects in public by design, so keep
-- that schema non-writable to API roles. This also prevents an untrusted
-- object from being introduced ahead of a trusted name in a function path.
revoke create on schema public from public, anon, authenticated;

drop trigger if exists trips_prevent_owner_change on public.trips;
create trigger trips_prevent_owner_change
  before update of user_id on public.trips
  for each row execute function public.prevent_trip_owner_change();

drop trigger if exists saved_attractions_enforce_trip_owner on public.saved_attractions;
create trigger saved_attractions_enforce_trip_owner
  before insert or update of user_id, trip_id on public.saved_attractions
  for each row execute function public.enforce_trip_owner_consistency();

drop trigger if exists chat_messages_enforce_trip_owner on public.chat_messages;
create trigger chat_messages_enforce_trip_owner
  before insert or update of user_id, trip_id on public.chat_messages
  for each row execute function public.enforce_trip_owner_consistency();

drop trigger if exists feedback_pulses_enforce_trip_owner on public.feedback_pulses;
create trigger feedback_pulses_enforce_trip_owner
  before insert or update of user_id, trip_id on public.feedback_pulses
  for each row execute function public.enforce_trip_owner_consistency();

drop trigger if exists feedback_outcomes_enforce_trip_owner on public.feedback_outcomes;
create trigger feedback_outcomes_enforce_trip_owner
  before insert or update of user_id, trip_id on public.feedback_outcomes
  for each row execute function public.enforce_trip_owner_consistency();

drop trigger if exists trip_shares_enforce_trip_owner on public.trip_shares;
create trigger trip_shares_enforce_trip_owner
  before insert or update of created_by, trip_id on public.trip_shares
  for each row execute function public.enforce_trip_owner_consistency();

drop trigger if exists trip_readiness_enforce_trip_owner on public.trip_readiness;
create trigger trip_readiness_enforce_trip_owner
  before insert or update of user_id, trip_id on public.trip_readiness
  for each row execute function public.enforce_trip_owner_consistency();

-- Make this file the source of truth for policies on application tables. This
-- removes legacy FOR ALL policies before recreating a least-privilege set.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles',
        'trips',
        'family_vibes',
        'saved_attractions',
        'chat_messages',
        'feedback_pulses',
        'feedback_outcomes',
        'feedback_messages',
        'trip_shares',
        'trip_readiness'
      ])
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.family_vibes enable row level security;
alter table public.saved_attractions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.feedback_pulses enable row level security;
alter table public.feedback_outcomes enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.trip_shares enable row level security;
alter table public.trip_readiness enable row level security;

-- Profiles are created by the signup trigger and can be edited by their owner.
-- Direct profile deletion is intentionally disabled; account deletion goes
-- through the server route so the auth user and cascading data are removed.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke delete on table public.profiles from public, anon, authenticated;

create policy trips_select_own on public.trips
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy trips_insert_own on public.trips
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy trips_update_own on public.trips
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy trips_delete_own on public.trips
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy family_vibes_select_own on public.family_vibes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy family_vibes_insert_own on public.family_vibes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy family_vibes_update_own on public.family_vibes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy family_vibes_delete_own on public.family_vibes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy saved_attractions_select_own on public.saved_attractions
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = saved_attractions.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

create policy saved_attractions_insert_own on public.saved_attractions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = saved_attractions.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

create policy saved_attractions_update_own on public.saved_attractions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = saved_attractions.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

create policy saved_attractions_delete_own on public.saved_attractions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Scout history needs SELECT plus INSERT. Both user and assistant rows are
-- inserted with the signed-in user's Supabase client, so role is not narrowed.
create policy chat_messages_select_own on public.chat_messages
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = chat_messages.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

create policy chat_messages_insert_own on public.chat_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = chat_messages.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

-- Feedback is append-only for signed-in users. Server routes insert both user
-- and assistant feedback-message rows through the authenticated client.
create policy feedback_pulses_insert_own on public.feedback_pulses
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = feedback_pulses.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

create policy feedback_outcomes_insert_own on public.feedback_outcomes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips trip
        where trip.id = feedback_outcomes.trip_id
          and trip.user_id = (select auth.uid())
      )
    )
  );

create policy feedback_messages_insert_own on public.feedback_messages
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy trip_shares_select_own on public.trip_shares
  for select to authenticated
  using (
    (select auth.uid()) = created_by
    and exists (
      select 1 from public.trips trip
      where trip.id = trip_shares.trip_id
        and trip.user_id = (select auth.uid())
    )
  );

create policy trip_shares_insert_own on public.trip_shares
  for insert to authenticated
  with check (
    (select auth.uid()) = created_by
    and exists (
      select 1 from public.trips trip
      where trip.id = trip_shares.trip_id
        and trip.user_id = (select auth.uid())
    )
  );

create policy trip_shares_update_own on public.trip_shares
  for update to authenticated
  using ((select auth.uid()) = created_by)
  with check (
    (select auth.uid()) = created_by
    and exists (
      select 1 from public.trips trip
      where trip.id = trip_shares.trip_id
        and trip.user_id = (select auth.uid())
    )
  );

create policy trip_shares_delete_own on public.trip_shares
  for delete to authenticated
  using ((select auth.uid()) = created_by);

create policy trip_readiness_select_own on public.trip_readiness
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips trip
      where trip.id = trip_readiness.trip_id
        and trip.user_id = (select auth.uid())
    )
  );

create policy trip_readiness_insert_own on public.trip_readiness
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips trip
      where trip.id = trip_readiness.trip_id
        and trip.user_id = (select auth.uid())
    )
  );

create policy trip_readiness_update_own on public.trip_readiness
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips trip
      where trip.id = trip_readiness.trip_id
        and trip.user_id = (select auth.uid())
    )
  );

create policy trip_readiness_delete_own on public.trip_readiness
  for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;

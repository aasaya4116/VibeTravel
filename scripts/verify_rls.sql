-- Read-only verification for scripts/013_harden_rls_policies.sql.
-- Run in the Supabase SQL editor after the migration. It checks the expected
-- access model plus live-schema drift, then returns audit inventories.

do $$
declare
  missing_expected_tables text[];
  unprotected_public_tables text[];
  unsafe_policy_count integer;
  exact_policy_mismatch_count integer;
  unexpected_public_policy_count integer;
  application_policy_count integer;
  cross_owner_count bigint;
  incorrect_trigger_count integer;
  unexpected_reviewed_trigger_count integer;
  signup_trigger_mismatch_count integer;
  reviewed_function_mismatch_count integer;
  unsafe_definer_count integer;
  unexpected_definer_count integer;
  public_definer_grant_count integer;
  shared_reader_is_definer boolean;
  schema_create_grant_count integer;
  storage_bucket_count integer := 0;
  public_storage_bucket_count integer := 0;
  storage_policy_count integer := 0;
  unsafe_storage_policy_count integer := 0;
  storage_bucket_inventory jsonb := '[]'::jsonb;
  expected_policy record;
  expected_policy_ddl text;
  expected_policy_schema name;
begin
  select array_agg(required.table_name order by required.table_name)
    into missing_expected_tables
  from unnest(array[
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
  ]) required(table_name)
  where to_regclass(format('public.%I', required.table_name)) is null;

  if missing_expected_tables is not null then
    raise exception 'Expected application tables are missing: %', array_to_string(missing_expected_tables, ', ');
  end if;

  -- Audit every current and future ordinary/partitioned table in public, not
  -- only the tables known when this verifier was written.
  select array_agg(relation.relname order by relation.relname)
    into unprotected_public_tables
  from pg_class relation
  join pg_namespace schema_definition on schema_definition.oid = relation.relnamespace
  where schema_definition.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity is not true;

  if unprotected_public_tables is not null then
    raise exception 'RLS is disabled on public table(s): %', array_to_string(unprotected_public_tables, ', ');
  end if;

  -- Fail closed on every policy in public, including policies on tables added
  -- after this audit. A new table may remain deny-all, but any new access policy
  -- must be added to the reviewed manifest below before verification can pass.
  select count(*)
    into unsafe_policy_count
  from pg_policies
  where schemaname = 'public'
    and (
      cmd = 'ALL'
      or 'public' = any (roles)
      or 'anon' = any (roles)
      or roles <> array['authenticated']::name[]
    );

  if unsafe_policy_count > 0 then
    raise exception 'Found % public policy/policies with ALL or a role scope other than authenticated-only.', unsafe_policy_count;
  end if;

  select count(*)
    into unexpected_public_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename <> all (array[
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
    ]);

  if unexpected_public_policy_count > 0 then
    raise exception 'Found % unreviewed policy/policies on additional public tables.', unexpected_public_policy_count;
  end if;

  -- Let this PostgreSQL server parse and deparse the reviewed predicates on
  -- session-local mirror tables. Comparing that output to pg_policies retains
  -- every security-significant parenthesis and avoids a home-grown SQL
  -- normalizer silently equating `a AND (b OR c)` with `(a AND b) OR c`.
  create temporary table expected_rls_policies (
    table_name text not null,
    policy_name text not null,
    command text not null,
    using_expression text,
    check_expression text
  ) on commit drop;

  insert into expected_rls_policies (
    table_name,
    policy_name,
    command,
    using_expression,
    check_expression
  )
  values
      ('profiles', 'profiles_select_own', 'SELECT', '(select auth.uid()) = id', null::text),
      ('profiles', 'profiles_insert_own', 'INSERT', null::text, '(select auth.uid()) = id'),
      ('profiles', 'profiles_update_own', 'UPDATE', '(select auth.uid()) = id', '(select auth.uid()) = id'),
      ('trips', 'trips_select_own', 'SELECT', '(select auth.uid()) = user_id', null::text),
      ('trips', 'trips_insert_own', 'INSERT', null::text, '(select auth.uid()) = user_id'),
      ('trips', 'trips_update_own', 'UPDATE', '(select auth.uid()) = user_id', '(select auth.uid()) = user_id'),
      ('trips', 'trips_delete_own', 'DELETE', '(select auth.uid()) = user_id', null::text),
      ('family_vibes', 'family_vibes_select_own', 'SELECT', '(select auth.uid()) = user_id', null::text),
      ('family_vibes', 'family_vibes_insert_own', 'INSERT', null::text, '(select auth.uid()) = user_id'),
      ('family_vibes', 'family_vibes_update_own', 'UPDATE', '(select auth.uid()) = user_id', '(select auth.uid()) = user_id'),
      ('family_vibes', 'family_vibes_delete_own', 'DELETE', '(select auth.uid()) = user_id', null::text),
      (
        'saved_attractions',
        'saved_attractions_select_own',
        'SELECT',
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = saved_attractions.trip_id and trip.user_id = (select auth.uid())))',
        null::text
      ),
      (
        'saved_attractions',
        'saved_attractions_insert_own',
        'INSERT',
        null::text,
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = saved_attractions.trip_id and trip.user_id = (select auth.uid())))'
      ),
      (
        'saved_attractions',
        'saved_attractions_update_own',
        'UPDATE',
        '(select auth.uid()) = user_id',
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = saved_attractions.trip_id and trip.user_id = (select auth.uid())))'
      ),
      ('saved_attractions', 'saved_attractions_delete_own', 'DELETE', '(select auth.uid()) = user_id', null::text),
      (
        'chat_messages',
        'chat_messages_select_own',
        'SELECT',
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = chat_messages.trip_id and trip.user_id = (select auth.uid())))',
        null::text
      ),
      (
        'chat_messages',
        'chat_messages_insert_own',
        'INSERT',
        null::text,
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = chat_messages.trip_id and trip.user_id = (select auth.uid())))'
      ),
      (
        'feedback_pulses',
        'feedback_pulses_insert_own',
        'INSERT',
        null::text,
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = feedback_pulses.trip_id and trip.user_id = (select auth.uid())))'
      ),
      (
        'feedback_outcomes',
        'feedback_outcomes_insert_own',
        'INSERT',
        null::text,
        '(select auth.uid()) = user_id and (trip_id is null or exists (select 1 from public.trips trip where trip.id = feedback_outcomes.trip_id and trip.user_id = (select auth.uid())))'
      ),
      ('feedback_messages', 'feedback_messages_insert_own', 'INSERT', null::text, '(select auth.uid()) = user_id'),
      (
        'trip_shares',
        'trip_shares_select_own',
        'SELECT',
        '(select auth.uid()) = created_by and exists (select 1 from public.trips trip where trip.id = trip_shares.trip_id and trip.user_id = (select auth.uid()))',
        null::text
      ),
      (
        'trip_shares',
        'trip_shares_insert_own',
        'INSERT',
        null::text,
        '(select auth.uid()) = created_by and exists (select 1 from public.trips trip where trip.id = trip_shares.trip_id and trip.user_id = (select auth.uid()))'
      ),
      (
        'trip_shares',
        'trip_shares_update_own',
        'UPDATE',
        '(select auth.uid()) = created_by',
        '(select auth.uid()) = created_by and exists (select 1 from public.trips trip where trip.id = trip_shares.trip_id and trip.user_id = (select auth.uid()))'
      ),
      ('trip_shares', 'trip_shares_delete_own', 'DELETE', '(select auth.uid()) = created_by', null::text),
      (
        'trip_readiness',
        'trip_readiness_select_own',
        'SELECT',
        '(select auth.uid()) = user_id and exists (select 1 from public.trips trip where trip.id = trip_readiness.trip_id and trip.user_id = (select auth.uid()))',
        null::text
      ),
      (
        'trip_readiness',
        'trip_readiness_insert_own',
        'INSERT',
        null::text,
        '(select auth.uid()) = user_id and exists (select 1 from public.trips trip where trip.id = trip_readiness.trip_id and trip.user_id = (select auth.uid()))'
      ),
      (
        'trip_readiness',
        'trip_readiness_update_own',
        'UPDATE',
        '(select auth.uid()) = user_id',
        '(select auth.uid()) = user_id and exists (select 1 from public.trips trip where trip.id = trip_readiness.trip_id and trip.user_id = (select auth.uid()))'
      ),
      ('trip_readiness', 'trip_readiness_delete_own', 'DELETE', '(select auth.uid()) = user_id', null::text);

  create temporary table profiles (like public.profiles) on commit drop;
  create temporary table trips (like public.trips) on commit drop;
  create temporary table family_vibes (like public.family_vibes) on commit drop;
  create temporary table saved_attractions (like public.saved_attractions) on commit drop;
  create temporary table chat_messages (like public.chat_messages) on commit drop;
  create temporary table feedback_pulses (like public.feedback_pulses) on commit drop;
  create temporary table feedback_outcomes (like public.feedback_outcomes) on commit drop;
  create temporary table feedback_messages (like public.feedback_messages) on commit drop;
  create temporary table trip_shares (like public.trip_shares) on commit drop;
  create temporary table trip_readiness (like public.trip_readiness) on commit drop;

  for expected_policy in
    select * from expected_rls_policies order by table_name, policy_name
  loop
    expected_policy_ddl := format(
      'create policy %I on pg_temp.%I as permissive for %s to authenticated',
      expected_policy.policy_name,
      expected_policy.table_name,
      expected_policy.command
    );

    if expected_policy.using_expression is not null then
      expected_policy_ddl := expected_policy_ddl
        || format(' using (%s)', expected_policy.using_expression);
    end if;

    if expected_policy.check_expression is not null then
      expected_policy_ddl := expected_policy_ddl
        || format(' with check (%s)', expected_policy.check_expression);
    end if;

    execute expected_policy_ddl;
  end loop;

  select schema_definition.nspname
    into expected_policy_schema
  from pg_namespace schema_definition
  where schema_definition.oid = pg_my_temp_schema();

  with expected as (
    select policy.*
    from pg_policies policy
    where policy.schemaname = expected_policy_schema
      and policy.tablename = any (array[
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
  ),
  actual as (
    select policy.*
    from pg_policies policy
    where policy.schemaname = 'public'
  ),
  compared as (
    select
      expected.policyname as expected_policy_name,
      actual.policyname as actual_policy_name,
      expected.tablename as expected_table_name,
      actual.tablename as actual_table_name,
      expected.permissive as expected_permissive,
      actual.permissive as actual_permissive,
      expected.roles as expected_roles,
      actual.roles as actual_roles,
      expected.cmd as expected_command,
      actual.cmd as actual_command,
      expected.qual as expected_using,
      actual.qual as actual_using,
      expected.with_check as expected_check,
      actual.with_check as actual_check
    from expected
    full join actual
      on actual.tablename = expected.tablename
      and actual.policyname = expected.policyname
  )
  select count(*)
    into exact_policy_mismatch_count
  from compared
  where expected_policy_name is null
    or actual_policy_name is null
    or actual_table_name is distinct from expected_table_name
    or actual_permissive is distinct from expected_permissive
    or actual_roles is distinct from expected_roles
    or actual_command is distinct from expected_command
    or actual_using is distinct from expected_using
    or actual_check is distinct from expected_check;

  if exact_policy_mismatch_count > 0 then
    raise exception 'Found % missing or non-canonical application policy/policies.', exact_policy_mismatch_count;
  end if;

  select count(*)
    into application_policy_count
  from pg_policies
  where schemaname = 'public';

  if application_policy_count <> 28 then
    raise exception 'Expected exactly 28 reviewed public policies; found %.', application_policy_count;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'DELETE'
  ) then
    raise exception 'profiles must not expose a direct DELETE policy.';
  end if;

  if has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
    raise exception 'authenticated still has direct DELETE privilege on profiles.';
  end if;

  select
    (select count(*)
      from public.saved_attractions child
      join public.trips trip on trip.id = child.trip_id
      where child.trip_id is not null and child.user_id is distinct from trip.user_id)
    + (select count(*)
      from public.chat_messages child
      join public.trips trip on trip.id = child.trip_id
      where child.trip_id is not null and child.user_id is distinct from trip.user_id)
    + (select count(*)
      from public.feedback_pulses child
      join public.trips trip on trip.id = child.trip_id
      where child.trip_id is not null and child.user_id is distinct from trip.user_id)
    + (select count(*)
      from public.feedback_outcomes child
      join public.trips trip on trip.id = child.trip_id
      where child.trip_id is not null and child.user_id is distinct from trip.user_id)
    + (select count(*)
      from public.trip_shares child
      join public.trips trip on trip.id = child.trip_id
      where child.created_by is distinct from trip.user_id)
    + (select count(*)
      from public.trip_readiness child
      join public.trips trip on trip.id = child.trip_id
      where child.user_id is distinct from trip.user_id)
    into cross_owner_count;

  if cross_owner_count > 0 then
    raise exception 'Found % cross-owner trip relationship(s).', cross_owner_count;
  end if;

  -- tgtype uses PostgreSQL's trigger bit mask: ROW=1, BEFORE=2, INSERT=4,
  -- UPDATE=16. Resolve tgattr's attribute numbers back to names so an UPDATE OF
  -- trigger only passes when it watches the exact reviewed columns.
  select count(*)
    into incorrect_trigger_count
  from (
    values
      ('trips_prevent_owner_change', 'trips', 'public.prevent_trip_owner_change()', 19, array['user_id']::text[]),
      ('saved_attractions_enforce_trip_owner', 'saved_attractions', 'public.enforce_trip_owner_consistency()', 23, array['user_id', 'trip_id']::text[]),
      ('chat_messages_enforce_trip_owner', 'chat_messages', 'public.enforce_trip_owner_consistency()', 23, array['user_id', 'trip_id']::text[]),
      ('feedback_pulses_enforce_trip_owner', 'feedback_pulses', 'public.enforce_trip_owner_consistency()', 23, array['user_id', 'trip_id']::text[]),
      ('feedback_outcomes_enforce_trip_owner', 'feedback_outcomes', 'public.enforce_trip_owner_consistency()', 23, array['user_id', 'trip_id']::text[]),
      ('trip_shares_enforce_trip_owner', 'trip_shares', 'public.enforce_trip_owner_consistency()', 23, array['created_by', 'trip_id']::text[]),
      ('trip_readiness_enforce_trip_owner', 'trip_readiness', 'public.enforce_trip_owner_consistency()', 23, array['user_id', 'trip_id']::text[])
  ) expected(trigger_name, table_name, function_name, trigger_type, updated_columns)
  left join pg_trigger trigger_definition
    on trigger_definition.tgname = expected.trigger_name
    and trigger_definition.tgrelid = to_regclass(format('public.%I', expected.table_name))
    and not trigger_definition.tgisinternal
  left join lateral (
    select array_agg(attribute.attname::text order by selected_column.ordinality) as column_names
    from unnest(
      string_to_array(nullif(btrim(trigger_definition.tgattr::text), ''), ' ')::smallint[]
    ) with ordinality selected_column(attnum, ordinality)
    join pg_attribute attribute
      on attribute.attrelid = trigger_definition.tgrelid
      and attribute.attnum = selected_column.attnum
  ) trigger_columns on true
  where trigger_definition.oid is null
    or trigger_definition.tgfoid <> to_regprocedure(expected.function_name)::oid
    or trigger_definition.tgtype::integer <> expected.trigger_type
    or trigger_columns.column_names is distinct from expected.updated_columns
    or trigger_definition.tgenabled <> 'O'
    or trigger_definition.tgqual is not null
    or trigger_definition.tgnargs <> 0
    or octet_length(trigger_definition.tgargs) <> 0
    or trigger_definition.tgconstraint <> 0
    or trigger_definition.tgconstrrelid <> 0
    or trigger_definition.tgconstrindid <> 0
    or trigger_definition.tgdeferrable
    or trigger_definition.tginitdeferred
    or trigger_definition.tgoldtable is not null
    or trigger_definition.tgnewtable is not null
    or trigger_definition.tgparentid <> 0;

  if incorrect_trigger_count > 0 then
    raise exception 'Found % missing or non-canonical ownership trigger(s).', incorrect_trigger_count;
  end if;

  select count(*)
    into unexpected_reviewed_trigger_count
  from pg_trigger trigger_definition
  where not trigger_definition.tgisinternal
    and trigger_definition.tgfoid in (
      to_regprocedure('public.enforce_trip_owner_consistency()')::oid,
      to_regprocedure('public.prevent_trip_owner_change()')::oid
    )
    and not (
      (
        trigger_definition.tgfoid = to_regprocedure('public.prevent_trip_owner_change()')::oid
        and trigger_definition.tgname = 'trips_prevent_owner_change'
        and trigger_definition.tgrelid = to_regclass('public.trips')
      )
      or (
        trigger_definition.tgfoid = to_regprocedure('public.enforce_trip_owner_consistency()')::oid
        and (trigger_definition.tgname, trigger_definition.tgrelid) in (
          ('saved_attractions_enforce_trip_owner', to_regclass('public.saved_attractions')),
          ('chat_messages_enforce_trip_owner', to_regclass('public.chat_messages')),
          ('feedback_pulses_enforce_trip_owner', to_regclass('public.feedback_pulses')),
          ('feedback_outcomes_enforce_trip_owner', to_regclass('public.feedback_outcomes')),
          ('trip_shares_enforce_trip_owner', to_regclass('public.trip_shares')),
          ('trip_readiness_enforce_trip_owner', to_regclass('public.trip_readiness'))
        )
      )
    );

  if unexpected_reviewed_trigger_count > 0 then
    raise exception 'Found % unexpected trigger(s) calling a reviewed ownership function.', unexpected_reviewed_trigger_count;
  end if;

  select
    case when count(*) filter (
      where trigger_definition.tgname = 'on_auth_user_created'
        and trigger_definition.tgrelid = to_regclass('auth.users')
        and trigger_definition.tgfoid = to_regprocedure('public.handle_new_user()')::oid
        and trigger_definition.tgtype::integer = 5
        and btrim(trigger_definition.tgattr::text) = ''
        and trigger_definition.tgenabled = 'O'
        and trigger_definition.tgqual is null
        and trigger_definition.tgnargs = 0
        and octet_length(trigger_definition.tgargs) = 0
        and trigger_definition.tgconstraint = 0
        and trigger_definition.tgconstrrelid = 0
        and trigger_definition.tgconstrindid = 0
        and not trigger_definition.tgdeferrable
        and not trigger_definition.tginitdeferred
        and trigger_definition.tgoldtable is null
        and trigger_definition.tgnewtable is null
        and trigger_definition.tgparentid = 0
    ) = 1 then 0 else 1 end
    + count(*) filter (
      where (
        trigger_definition.tgname = 'on_auth_user_created'
        or trigger_definition.tgfoid = to_regprocedure('public.handle_new_user()')::oid
      )
      and not (
        trigger_definition.tgname = 'on_auth_user_created'
        and trigger_definition.tgrelid = to_regclass('auth.users')
        and trigger_definition.tgfoid = to_regprocedure('public.handle_new_user()')::oid
        and trigger_definition.tgtype::integer = 5
        and btrim(trigger_definition.tgattr::text) = ''
        and trigger_definition.tgenabled = 'O'
        and trigger_definition.tgqual is null
        and trigger_definition.tgnargs = 0
        and octet_length(trigger_definition.tgargs) = 0
        and trigger_definition.tgconstraint = 0
        and trigger_definition.tgconstrrelid = 0
        and trigger_definition.tgconstrindid = 0
        and not trigger_definition.tgdeferrable
        and not trigger_definition.tginitdeferred
        and trigger_definition.tgoldtable is null
        and trigger_definition.tgnewtable is null
        and trigger_definition.tgparentid = 0
      )
    )
    into signup_trigger_mismatch_count
  from pg_trigger trigger_definition
  where not trigger_definition.tgisinternal
    and (
      trigger_definition.tgname = 'on_auth_user_created'
      or trigger_definition.tgfoid = to_regprocedure('public.handle_new_user()')::oid
    );

  if signup_trigger_mismatch_count <> 0 then
    raise exception 'on_auth_user_created must be the exact enabled AFTER INSERT ROW trigger for handle_new_user().';
  end if;

  if to_regprocedure('public.handle_new_user()') is null
     or to_regprocedure('public.get_shared_trip(text)') is null
     or to_regprocedure('public.enforce_trip_owner_consistency()') is null
     or to_regprocedure('public.prevent_trip_owner_change()') is null then
    raise exception 'One or more reviewed public functions are missing.';
  end if;

  -- Every reviewed definer function is checked against its complete reviewed
  -- body and a fixed trusted owner. A function with the same name, signature,
  -- and search_path but altered SQL must not pass.
  with expected(
    signature,
    language_name,
    volatility,
    return_type,
    argument_names,
    function_body
  ) as (
    values
      (
        'public.enforce_trip_owner_consistency()',
        'plpgsql',
        'v'::"char",
        'trigger',
        null::text[],
        $enforce_owner_body$
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
$enforce_owner_body$
      ),
      (
        'public.prevent_trip_owner_change()',
        'plpgsql',
        'v'::"char",
        'trigger',
        null::text[],
        $prevent_owner_body$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '42501',
      message = 'A trip cannot be transferred to another account';
  end if;
  return new;
end;
$prevent_owner_body$
      ),
      (
        'public.handle_new_user()',
        'plpgsql',
        'v'::"char",
        'trigger',
        null::text[],
        $handle_body$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$handle_body$
      ),
      (
        'public.get_shared_trip(text)',
        'sql',
        's'::"char",
        'jsonb',
        array['p_token']::text[],
        $shared_body$
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
$shared_body$
      )
  )
  select count(*)
    into reviewed_function_mismatch_count
  from expected
  left join pg_proc function_definition
    on function_definition.oid = to_regprocedure(expected.signature)
  left join pg_language language_definition
    on language_definition.oid = function_definition.prolang
  where function_definition.oid is null
    or function_definition.proowner <> to_regrole('postgres')
    or function_definition.prosecdef is not true
    or function_definition.prokind <> 'f'
    or language_definition.lanname <> expected.language_name
    or function_definition.provolatile <> expected.volatility
    or function_definition.prorettype <> to_regtype(expected.return_type)
    or function_definition.proretset
    or function_definition.proisstrict
    or function_definition.proleakproof
    or function_definition.proparallel <> 'u'
    or function_definition.proargnames is distinct from expected.argument_names
    or btrim(replace(function_definition.prosrc, chr(13), ''))
       is distinct from btrim(replace(expected.function_body, chr(13), ''));

  if reviewed_function_mismatch_count > 0 then
    raise exception 'A reviewed SECURITY DEFINER function has an unreviewed owner, body, or function property.';
  end if;

  -- No unreviewed SECURITY DEFINER may be added silently.
  select count(*)
    into unexpected_definer_count
  from pg_proc function_definition
  join pg_namespace schema_definition on schema_definition.oid = function_definition.pronamespace
  where schema_definition.nspname = 'public'
    and function_definition.prosecdef
    and function_definition.oid not in (
      to_regprocedure('public.handle_new_user()')::oid,
      to_regprocedure('public.get_shared_trip(text)')::oid,
      to_regprocedure('public.enforce_trip_owner_consistency()')::oid,
      to_regprocedure('public.prevent_trip_owner_change()')::oid
    );

  if unexpected_definer_count > 0 then
    raise exception 'Found % unreviewed SECURITY DEFINER function(s) in public.', unexpected_definer_count;
  end if;

  -- Every reviewed SECURITY DEFINER must use the migration's exact trusted
  -- search path, with pg_catalog first and pg_temp last.
  select count(*)
    into unsafe_definer_count
  from pg_proc function_definition
  join pg_namespace schema_definition on schema_definition.oid = function_definition.pronamespace
  where schema_definition.nspname = 'public'
    and function_definition.prosecdef
    and (
      function_definition.proowner <> to_regrole('postgres')
      or cardinality(coalesce(function_definition.proconfig, array[]::text[])) <> 1
      or not exists (
        select 1
        from unnest(coalesce(function_definition.proconfig, array[]::text[])) setting(value)
        where regexp_replace(lower(setting.value), '[[:space:]]', '', 'g') =
          'search_path=pg_catalog,public,pg_temp'
      )
    );

  if unsafe_definer_count > 0 then
    raise exception 'Found % SECURITY DEFINER function(s) without the trusted postgres owner and canonical search_path.', unsafe_definer_count;
  end if;

  select function_definition.prosecdef
    into shared_reader_is_definer
  from pg_proc function_definition
  where function_definition.oid = to_regprocedure('public.get_shared_trip(text)')::oid;

  if shared_reader_is_definer is not true then
    raise exception 'get_shared_trip(text) must remain SECURITY DEFINER for anonymous read-only sharing.';
  end if;

  select count(*)
    into schema_create_grant_count
  from pg_namespace schema_definition
  cross join lateral aclexplode(
    coalesce(
      schema_definition.nspacl,
      acldefault('n', schema_definition.nspowner)
    )
  ) schema_acl
  where schema_definition.nspname = 'public'
    and schema_acl.privilege_type = 'CREATE'
    and schema_acl.grantee in (
      0::oid,
      to_regrole('anon')::oid,
      to_regrole('authenticated')::oid
    );

  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    schema_create_grant_count := schema_create_grant_count + 1;
  end if;

  if schema_create_grant_count > 0 then
    raise exception 'PUBLIC, anon, and authenticated must not have CREATE on schema public.';
  end if;

  -- get_shared_trip(text) is the only SECURITY DEFINER RPC exposed to API
  -- roles. Trigger functions and any future definers must not be API-callable.
  select count(distinct function_definition.oid)
    into public_definer_grant_count
  from pg_proc function_definition
  join pg_namespace schema_definition on schema_definition.oid = function_definition.pronamespace
  join lateral aclexplode(
    coalesce(
      function_definition.proacl,
      acldefault('f', function_definition.proowner)
    )
  ) function_acl on true
  where schema_definition.nspname = 'public'
    and function_definition.prosecdef
    and function_definition.oid <> to_regprocedure('public.get_shared_trip(text)')::oid
    and function_acl.privilege_type = 'EXECUTE'
    and function_acl.grantee in (
      0::oid,
      to_regrole('anon')::oid,
      to_regrole('authenticated')::oid
    );

  if public_definer_grant_count > 0 then
    raise exception 'Found % unexpected API-executable SECURITY DEFINER function(s).', public_definer_grant_count;
  end if;

  if not has_function_privilege('anon', 'public.get_shared_trip(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_shared_trip(text)', 'EXECUTE')
     or exists (
       select 1
       from pg_proc function_definition
       join lateral aclexplode(
         coalesce(
           function_definition.proacl,
           acldefault('f', function_definition.proowner)
         )
       ) function_acl on true
       where function_definition.oid = to_regprocedure('public.get_shared_trip(text)')::oid
         and function_acl.privilege_type = 'EXECUTE'
         and function_acl.grantee = 0::oid
     ) then
    raise exception 'get_shared_trip(text) does not have the intended anon/authenticated-only EXECUTE grants.';
  end if;

  -- Storage is optional today. If it is introduced, reject public buckets and
  -- broad/open policies rather than treating the presence of any policy as
  -- proof that stored files are private.
  -- Audit latent policies even when there are no buckets yet: otherwise a
  -- future bucket could inherit an already-open policy before the next audit.
  select count(*)
    into unsafe_storage_policy_count
  from pg_policies policy
  where policy.schemaname = 'storage'
    and policy.tablename in ('buckets', 'objects')
    and (
      policy.cmd = 'ALL'
      or 'public' = any (policy.roles)
      or 'anon' = any (policy.roles)
      or policy.roles <> array['authenticated']::name[]
      or (
        policy.cmd in ('SELECT', 'UPDATE', 'DELETE')
        and (
          policy.qual is null
          or regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g') = 'true'
          or position('ortrue' in regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g')) > 0
          or position('trueor' in regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g')) > 0
          or (
            policy.tablename = 'objects'
            and (
              position('auth.uid()' in lower(policy.qual)) = 0
              or position('bucket_id' in lower(policy.qual)) = 0
            )
          )
        )
      )
      or (
        policy.cmd in ('INSERT', 'UPDATE')
        and (
          policy.with_check is null
          or regexp_replace(lower(policy.with_check), '[[:space:]()]', '', 'g') = 'true'
          or position('ortrue' in regexp_replace(lower(policy.with_check), '[[:space:]()]', '', 'g')) > 0
          or position('trueor' in regexp_replace(lower(policy.with_check), '[[:space:]()]', '', 'g')) > 0
          or (
            policy.tablename = 'objects'
            and (
              position('auth.uid()' in lower(policy.with_check)) = 0
              or position('bucket_id' in lower(policy.with_check)) = 0
            )
          )
        )
      )
    );

  if unsafe_storage_policy_count > 0 then
    raise exception 'Found % public, anonymous, broad, or insufficiently scoped Storage policy/policies.', unsafe_storage_policy_count;
  end if;

  if to_regclass('storage.buckets') is not null then
    execute $storage$
      select
        count(*),
        count(*) filter (
          where coalesce((to_jsonb(bucket) ->> 'public')::boolean, false)
        ),
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', bucket.id,
              'name', bucket.name,
              'public', to_jsonb(bucket) -> 'public'
            )
            order by bucket.name
          ),
          '[]'::jsonb
        )
      from storage.buckets bucket
    $storage$
    into storage_bucket_count, public_storage_bucket_count, storage_bucket_inventory;

    if storage_bucket_count > 0 then
      if public_storage_bucket_count > 0 then
        raise exception 'Found % public Storage bucket(s); this audit requires private buckets.', public_storage_bucket_count;
      end if;

      if to_regclass('storage.objects') is null
         or not coalesce((
           select relation.relrowsecurity
           from pg_class relation
           where relation.oid = to_regclass('storage.objects')
         ), false)
         or not coalesce((
           select relation.relrowsecurity
           from pg_class relation
           where relation.oid = to_regclass('storage.buckets')
         ), false) then
        raise exception 'Storage buckets exist, but RLS is not enabled on storage.buckets and storage.objects.';
      end if;

      select count(*)
        into storage_policy_count
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects';

      if storage_policy_count = 0 then
        raise exception 'Storage buckets exist, but storage.objects has no reviewed RLS policy.';
      end if;
    end if;
  end if;

  raise notice 'Storage bucket inventory: %', storage_bucket_inventory;
  raise notice 'RLS verification passed';
end
$$;

-- Audit inventories returned after all assertions pass.
select
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_class relation
join pg_namespace schema_definition on schema_definition.oid = relation.relnamespace
where schema_definition.nspname = 'public'
  and relation.relkind in ('r', 'p')
order by relation.relname;

select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

select
  function_definition.oid::regprocedure as function_name,
  function_definition.proconfig as function_config,
  has_function_privilege('anon', function_definition.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', function_definition.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc function_definition
join pg_namespace schema_definition on schema_definition.oid = function_definition.pronamespace
where schema_definition.nspname = 'public'
  and function_definition.prosecdef
order by function_definition.oid::regprocedure::text;

select
  case
    when schema_acl.grantee = 0 then 'PUBLIC'
    else pg_get_userbyid(schema_acl.grantee)
  end as grantee,
  schema_acl.privilege_type,
  schema_acl.is_grantable
from pg_namespace schema_definition
cross join lateral aclexplode(
  coalesce(
    schema_definition.nspacl,
    acldefault('n', schema_definition.nspowner)
  )
) schema_acl
where schema_definition.nspname = 'public'
order by grantee, schema_acl.privilege_type;

select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
order by tablename, cmd, policyname;

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  fileURLToPath(new URL("./013_harden_rls_policies.sql", import.meta.url)),
  "utf8"
)
const verifier = readFileSync(
  fileURLToPath(new URL("./verify_rls.sql", import.meta.url)),
  "utf8"
)

describe("RLS hardening migration", () => {
  it("is atomic and protects every application table", () => {
    expect(migration.trimStart()).toMatch(/begin;/i)
    expect(migration.trimEnd()).toMatch(/commit;$/i)

    const tables = [
      "profiles",
      "trips",
      "family_vibes",
      "saved_attractions",
      "chat_messages",
      "feedback_pulses",
      "feedback_outcomes",
      "feedback_messages",
      "trip_shares",
      "trip_readiness",
    ]
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`)
    }
  })

  it("uses explicit authenticated policies and explicit write checks", () => {
    const policyBlocks = migration.match(/create policy[\s\S]*?;/gi) ?? []
    expect(policyBlocks).toHaveLength(28)
    expect(policyBlocks.some((policy) => /for\s+all/i.test(policy))).toBe(false)

    for (const policy of policyBlocks) {
      expect(policy).toMatch(/to\s+authenticated/i)
      if (/for\s+(insert|update)/i.test(policy)) {
        expect(policy).toMatch(/with\s+check/i)
        expect(policy).toContain("auth.uid()")
      }
    }
  })

  it("blocks cross-owner trip links without breaking message inserts", () => {
    for (const table of [
      "saved_attractions",
      "chat_messages",
      "feedback_pulses",
      "feedback_outcomes",
      "trip_shares",
      "trip_readiness",
    ]) {
      expect(migration).toContain(`${table}_enforce_trip_owner`)
    }

    expect(migration).toContain("chat_messages_insert_own")
    expect(migration).toContain("feedback_messages_insert_own")
    expect(migration).toContain("role is not narrowed")
  })

  it("requires full account deletion instead of direct profile deletion", () => {
    expect(migration).toContain(
      "revoke delete on table public.profiles from public, anon, authenticated;"
    )
    expect(migration).not.toMatch(/create policy\s+profiles_delete/i)
  })

  it("pins and limits SECURITY DEFINER functions", () => {
    expect(migration).toContain("create or replace function public.handle_new_user()")
    expect(migration).toContain("create or replace function public.get_shared_trip(p_token text)")
    expect(migration).toContain("alter function public.handle_new_user() owner to postgres;")
    expect(migration).toContain(
      "alter function public.get_shared_trip(text) owner to postgres;"
    )
    expect(migration).toContain("set search_path = pg_catalog, public, pg_temp")
    expect(migration).toContain(
      "grant execute on function public.get_shared_trip(text) to anon, authenticated;"
    )
    expect(migration).toContain(
      "revoke create on schema public from public, anon, authenticated;"
    )
  })
})

describe("RLS live verifier", () => {
  it("checks every public table and rejects unreviewed public policies", () => {
    expect(verifier).toContain("relation.relkind in ('r', 'p')")
    expect(verifier).toContain("relation.relrowsecurity is not true")
    expect(verifier).toContain("unexpected_public_policy_count")
    expect(verifier).toContain("roles <> array['authenticated']::name[]")
    expect(verifier).toContain("Expected exactly 28 reviewed public policies")
  })

  it("compares the complete canonical definition of each application policy", () => {
    const migrationPolicyNames = Array.from(
      migration.matchAll(/create policy\s+(\w+)/gi),
      (match) => match[1]
    )

    expect(migrationPolicyNames).toHaveLength(28)
    for (const policyName of migrationPolicyNames) {
      expect(verifier).toContain(`'${policyName}'`)
    }
    expect(verifier).toContain("exact_policy_mismatch_count")
    expect(verifier).toContain("actual_using is distinct from expected_using")
    expect(verifier).toContain("actual_check is distinct from expected_check")
    expect(verifier).toContain("create temporary table expected_rls_policies")
    expect(verifier).toContain("create policy %I on pg_temp.%I")
    expect(verifier).toContain("pg_my_temp_schema()")
    expect(verifier).toContain("saved_attractions_select_own")
    expect(verifier).toContain("trip_readiness_update_own")
    expect(verifier).not.toContain("'[[:space:]()\"]'")
    expect(verifier).not.toContain("position('auth.uid()' in qual)")
  })

  it("verifies trigger placement, behavior, and SECURITY DEFINER invariants", () => {
    expect(verifier).toContain("trigger_definition.tgrelid")
    expect(verifier).toContain("trigger_definition.tgfoid")
    expect(verifier).toContain("trigger_definition.tgtype::integer")
    expect(verifier).toContain("trigger_definition.tgattr::text")
    expect(verifier).toContain("trigger_definition.tgqual is not null")
    expect(verifier).toContain("trigger_definition.tgnargs <> 0")
    expect(verifier).toContain("unexpected_reviewed_trigger_count")
    expect(verifier).toContain("unexpected trigger(s) calling a reviewed ownership function")
    expect(verifier).toContain("attribute.attname::text")
    expect(verifier).toContain("function_definition.prosecdef")
    expect(verifier).toContain("function_definition.proowner <> to_regrole('postgres')")
    expect(verifier).toContain("function_definition.prosrc")
    expect(verifier).toContain("public.enforce_trip_owner_consistency()")
    expect(verifier).toContain("public.prevent_trip_owner_change()")
    expect(verifier).toContain("row_owner is distinct from linked_owner")
    expect(verifier).toContain("A trip cannot be transferred to another account")
    expect(verifier).toContain("on_auth_user_created")
    expect(verifier).toContain("aclexplode(")
    expect(verifier).toContain("shared_reader_is_definer is not true")
    expect(verifier).toContain("search_path=pg_catalog,public,pg_temp")
    expect(verifier).toContain("schema_acl.grantee in (")
    expect(verifier).toContain("0::oid")
    expect(verifier).not.toContain("api_role.role_name::name")
  })

  it("fails closed on public buckets and broad Storage policies", () => {
    expect(verifier).toContain("to_regclass('storage.buckets')")
    expect(verifier).toContain("public_storage_bucket_count")
    expect(verifier).toContain("unsafe_storage_policy_count")
    expect(verifier).toContain("policy.tablename in ('buckets', 'objects')")
    expect(verifier).toContain("position('bucket_id' in lower(policy.qual))")
    expect(verifier).toContain("Storage bucket inventory")
    expect(verifier.indexOf("into unsafe_storage_policy_count")).toBeLessThan(
      verifier.indexOf("if storage_bucket_count > 0 then")
    )
  })
})

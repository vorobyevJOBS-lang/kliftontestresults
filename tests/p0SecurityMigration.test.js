import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("../p0_hiring_security_and_archive.sql", import.meta.url));
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

const legacyTables = [
  "results",
  "tools_results",
  "rezultat_results",
  "logis_results",
  "sails_results",
  "prim_results",
];

test("P0 migration guards every historical table without deleting rows", () => {
  for (const table of [...legacyTables, "admins", "candidate_profiles", "candidate_activity"]) {
    assert.match(sql, new RegExp(`['\"]${table}['\"]`));
  }

  assert.match(normalized, /create temporary table _evidencehire_p0_row_guard/);
  assert.match(normalized, /row count changed from % to %/);
  assert.match(normalized, /content_sha256 text/);
  assert.match(normalized, /string_agg\(to_jsonb\(source_row\)::text/);
  assert.match(normalized, /content fingerprint changed/);
  assert.match(normalized, /before update or delete or truncate on public\.%i/);
  assert.match(normalized, /execute function app_private\.block_legacy_result_mutation\(\)/);

  const protectedDataPattern = [
    ...legacyTables,
    "admins",
    "candidate_profiles",
    "candidate_activity",
    "candidates",
    "assessments",
  ].join("|");
  assert.doesNotMatch(normalized, new RegExp(`delete\\s+from\\s+public\\.(${protectedDataPattern})\\b`));
  assert.doesNotMatch(normalized, new RegExp(`truncate\\s+(table\\s+)?public\\.(${protectedDataPattern})\\b`));
  assert.doesNotMatch(
    normalized,
    new RegExp(`update\\s+public\\.(${[...legacyTables, "candidate_profiles", "candidate_activity"].join("|")})\\b`),
  );
});

test("browser roles lose direct access while the server proxy keeps least privilege", () => {
  assert.match(normalized, /alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from public, anon, authenticated, service_role/);
  assert.match(normalized, /alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role/);
  assert.match(
    normalized,
    /revoke all on table public\.%i from public, anon, authenticated, service_role/,
  );
  assert.match(
    normalized,
    /grant select on table public\.results, public\.tools_results, public\.rezultat_results, public\.logis_results, public\.sails_results, public\.prim_results to service_role/,
  );
  assert.doesNotMatch(normalized, /grant [^;]* on table [^;]*(results|candidate_profiles|candidate_activity)[^;]* to (anon|authenticated)/);
  assert.doesNotMatch(normalized, /grant [^;]*(insert|update|delete)[^;]* on table [^;]*(organizations|job_profiles|candidates|assessments|assessment_evidence|assessment_invites|outcome_followups|candidate_notes)[^;]* to service_role/);
});

test("plaintext legacy admin credentials are retired without removing admin rows", () => {
  assert.match(normalized, /update public\.admins set password = 'retired-' \|\| encode\(extensions\.gen_random_bytes\(16\), 'hex'\), password_hash = null/);
  assert.match(normalized, /where password not like 'retired-%' or password_hash is not null/);
  assert.match(normalized, /count\(distinct password\)/);
  assert.match(normalized, /where password not like 'retired-%' or password_hash is not null/);
  assert.doesNotMatch(normalized, /delete\s+from\s+public\.admins/);
});

test("strict branch authorization never treats a null admin branch as global access", () => {
  const functionStart = normalized.indexOf("create or replace function public.can_access_branch");
  const functionEnd = normalized.indexOf("$function$;", functionStart);
  const functionSql = normalized.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.match(functionSql, /m\.role::text = 'owner'/);
  assert.match(functionSql, /target_branch is not null/);
  assert.doesNotMatch(functionSql, /m\.branch_id is null/);
  assert.match(normalized, /create policy "owners insert memberships"/);
  assert.doesNotMatch(normalized, /owners (manage|insert|update|delete) memberships[^;]*array\['owner', 'admin'\]/);
});

test("candidate and assessment creation is one authenticated transactional RPC", () => {
  assert.match(
    normalized,
    /create function public\.create_candidate_assessment\( target_organization uuid, candidate_name text, candidate_email text, target_branch text, target_profile_key text, target_profile_definition jsonb, target_profile_version integer default 1, candidate_source text default null, target_candidate_modules text\[\] default '\{\}' \) returns jsonb/,
  );
  assert.match(normalized, /insert into public\.candidates\(/);
  assert.match(normalized, /insert into public\.assessments\(/);
  assert.match(normalized, /'assessment_id', created_assessment_id/);
  assert.match(normalized, /'candidate_id', created_candidate_id/);
  assert.match(normalized, /profile_definition, candidate_modules, branch_id/);
  assert.match(normalized, /p\.definition = target_profile_definition/);
  assert.match(normalized, /array\['owner', 'admin'\]/);
  assert.match(normalized, /grant execute on function public\.create_candidate_assessment\([^;]+\) to authenticated/);
  assert.doesNotMatch(normalized, /grant execute on function public\.create_candidate_assessment\([^;]+\) to anon/);
});

test("soft archive RPCs replace hard deletion", () => {
  assert.match(normalized, /add column if not exists archived_at timestamptz/);
  assert.match(normalized, /create or replace function public\.archive_assessment\(/);
  assert.match(normalized, /create or replace function public\.restore_assessment\(/);
  assert.match(normalized, /create or replace function public\.archive_candidate\(/);
  assert.match(normalized, /create or replace function public\.restore_candidate\(/);
  assert.match(normalized, /hard deletion is disabled/);
  assert.match(normalized, /create or replace function public\.purge_expired_candidates\(\)[\s\S]*update public\.candidates/);
});

test("migration is atomic and normalizes legacy invitation schemas safely", () => {
  assert.match(normalized, /^--[\s\S]* begin; set local lock_timeout/);
  assert.match(normalized, /in access exclusive mode/);
  assert.match(normalized, /alter column token_hash type bytea using decode\(token_hash, 'hex'\)/);
  assert.match(normalized, /add column if not exists opened_at timestamptz/);
  assert.match(normalized, /add column if not exists revoked_at timestamptz/);
  assert.match(normalized, /commit;$/);
});

test("capability-token RPCs use bytea hashes and remain anon-only", () => {
  assert.match(normalized, /i\.token_hash = extensions\.digest\(raw_token, 'sha256'\)/);
  assert.doesNotMatch(normalized, /token_hash\s*=\s*encode\(digest\(/);
  assert.match(normalized, /branch_id text, candidate_modules text\[\], organization_name text/);
  assert.match(normalized, /candidate_response_is_valid\(response_text, target_modules, true\)/);
  assert.match(normalized, /answer_count <> 166/);
  assert.match(normalized, /candidate_modules <@ array\['work_preferences_fc'\]::text\[\]/);
  assert.match(normalized, /create or replace function public\.set_assessment_candidate_modules/);
  assert.match(normalized, /candidate modules are frozen after the first invite/);
  assert.match(normalized, /grant execute on function public\.set_assessment_candidate_modules\(uuid, text\[\]\) to authenticated/);

  for (const signature of [
    "get_candidate_assignment(text)",
    "save_candidate_assignment_draft(text, text, boolean, text)",
    "submit_candidate_assignment(text, text, boolean, text)",
  ]) {
    const escaped = signature.replace(/[()]/g, "\\$&");
    assert.match(
      normalized,
      new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated, service_role`),
    );
    assert.match(
      normalized,
      new RegExp(`grant execute on function public\\.${escaped} to anon`),
    );
  }

  assert.match(normalized, /pipeline_stage = 'assignment'[^;]+pipeline_stage = 'new'/);
  assert.match(normalized, /pipeline_stage = 'interview'[^;]+pipeline_stage = 'assignment'/);
  assert.match(normalized, /old\.pipeline_stage in \('decision', 'offer', 'hired', 'reserve', 'declined'\) or new\.pipeline_stage in \('decision', 'offer', 'hired', 'reserve', 'declined'\)/);
  assert.match(normalized, /old\.status in \('decision', 'closed'\) or new\.status in \('decision', 'closed'\)/);
  assert.match(normalized, /before update of final_decision, decision_reason, pipeline_stage, status/);
  assert.match(normalized, /p\.version = a\.profile_version/);
  assert.match(normalized, /coalesce\(a\.profile_definition, selected_profile\.definition\)/);
  assert.match(normalized, /candidate_response text, consent_at timestamptz, consent_notice jsonb, submitted_at timestamptz/);
  assert.match(normalized, /consent_given is not true/);
  assert.doesNotMatch(normalized, /consent_notice = coalesce\(i\.consent_notice/);
  assert.doesNotMatch(normalized, /'version', notice_version/);

  for (const functionName of ["save_candidate_assignment_draft", "submit_candidate_assignment"]) {
    const functionStart = normalized.indexOf(`create function public.${functionName}(`);
    const functionEnd = normalized.indexOf("$function$;", functionStart);
    const functionSql = normalized.slice(functionStart, functionEnd);

    assert.ok(functionStart >= 0 && functionEnd > functionStart);
    assert.match(functionSql, /current_notice_version constant text := '2026-08-06-v1'/);
    assert.match(functionSql, /notice_version is distinct from current_notice_version/);
    assert.match(functionSql, /'version', current_notice_version/);
    assert.match(functionSql, /consent_notice = current_notice/);
    assert.match(functionSql, /candidate_consent_notice_superseded/);
    assert.match(functionSql, /'previousconsentat', previous_consent_at/);
    assert.match(functionSql, /'previousconsentnotice', previous_notice/);
    assert.match(functionSql, /for update of i/);
    assert.doesNotMatch(functionSql, /'version', notice_version/);
  }
  assert.doesNotMatch(normalized, /order by \(p\.version = a\.profile_version\) desc/);
  assert.match(normalized, /set expires_at = now\(\), revoked_at = now\(\)/);
});

test("independent evidence is hidden as draft, anchored and immutable after submission", () => {
  const evidencePolicyStart = normalized.indexOf('create policy "raters read permitted evidence"');
  const evidencePolicyEnd = normalized.indexOf('create policy "raters insert own evidence"', evidencePolicyStart);
  const evidencePolicy = normalized.slice(evidencePolicyStart, evidencePolicyEnd);

  assert.ok(evidencePolicyStart >= 0 && evidencePolicyEnd > evidencePolicyStart);
  assert.match(normalized, /add column if not exists submitted_at timestamptz/);
  assert.match(normalized, /create or replace function public\.has_submitted_assessment_evidence/);
  assert.match(normalized, /rater_id = \(select auth\.uid\(\)\) or \( method in \('reference', 'structured_reference'\)/);
  assert.match(evidencePolicy, /public\.can_access_assessment\(assessment_id\)/);
  assert.match(evidencePolicy, /submitted_at is not null and public\.can_manage_assessment/);
  assert.match(evidencePolicy, /public\.is_org_owner\(organization_id\) and public\.assessment_belongs_to_org\(assessment_id, organization_id\)/);
  assert.match(evidencePolicy, /or public\.has_submitted_assessment_evidence\(assessment_id\)/);
  assert.match(normalized, /create trigger protect_assessment_evidence_trigger/);
  assert.match(normalized, /submitted evidence is immutable/);
  assert.match(normalized, /create function public\.submit_assessment_evidence\(target_assessment uuid\)/);
  assert.match(normalized, /e\.rating not in \(1, 3, 5\)/);
  assert.match(normalized, /e\.item_id = 'observer_attestation'/);
  assert.match(normalized, /count\(distinct e\.rater_id\)[^;]+< 2/);
  assert.match(normalized, /profile definition is invalid or not approved for hiring/);
  assert.match(normalized, /not public\.can_manage_active_assessment\(target_assessment\)/);
});

test("approved profiles, decisions and concurrent saves fail closed", () => {
  assert.match(normalized, /coalesce\(new\.profile_definition ->> 'status', ''\) not in \('pilot', 'validated'\)/);
  assert.match(normalized, /coalesce\(target_profile_definition ->> 'status', ''\) not in \('pilot', 'validated'\)/);
  assert.match(normalized, /coalesce\(target_profile_definition ->> 'school', ''\) not in/);
  assert.match(normalized, /jsonb_array_length\(target_profile_definition -> 'interview'\) < 1/);
  assert.match(normalized, /jobanalysis,outcomedefinition/);
  assert.match(normalized, /old\.status is distinct from new\.status and new\.status in \('decision', 'closed'\)/);
  assert.match(normalized, /old\.pipeline_stage is distinct from new\.pipeline_stage or old\.final_decision is distinct from new\.final_decision/);
  assert.match(normalized, /a\.final_decision = 'offer' or a\.pipeline_stage in \('offer', 'hired'\)/);
  assert.match(normalized, /reference disposition is frozen after an offer/);
  assert.match(normalized, /create function public\.save_assessment_card/);
  assert.match(normalized, /expected_updated_at timestamptz/);
  assert.match(normalized, /assessment changed since it was opened/);
  assert.match(normalized, /from public\.assessments a where a\.id = target_assessment for update/);
});

test("canonical reference records preserve the newest legacy summary", () => {
  const backfillStart = normalized.indexOf("insert into public.assessment_reference_checks(");
  const freezeTrigger = normalized.indexOf("create trigger protect_reference_check_trigger");

  assert.ok(backfillStart >= 0);
  assert.ok(freezeTrigger > backfillStart);
  assert.match(normalized, /select distinct on \(e\.assessment_id\) e\.assessment_id, a\.organization_id, coalesce\(e\.notes, ''\), e\.rater_id/);
  assert.match(normalized, /where e\.method in \('reference', 'structured_reference'\) and e\.item_id = 'summary'/);
  assert.match(normalized, /order by e\.assessment_id, e\.updated_at desc nulls last, e\.created_at desc nulls last, e\.id desc on conflict \(assessment_id\) do nothing/);
});

test("outcome measure is bound to the frozen profile snapshot", () => {
  assert.match(normalized, /the kpi definition must match the frozen profile snapshot/);
  assert.match(normalized, /a\.profile_definition #>> '\{jobanalysis,outcomedefinition\}'/);
  assert.match(normalized, /manager rating must use anchor 1, 3 or 5/);
  assert.match(normalized, /new\.organization_id is distinct from old\.organization_id/);
  assert.match(normalized, /new\.assessment_id is distinct from old\.assessment_id/);
  assert.match(normalized, /new\.checkpoint_days is distinct from old\.checkpoint_days/);
  assert.match(normalized, /new\.recorded_by is distinct from old\.recorded_by/);
  assert.match(normalized, /outcome identity and attribution are immutable/);
});

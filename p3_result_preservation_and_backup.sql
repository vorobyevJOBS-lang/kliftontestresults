-- EvidenceHire P3: close the remaining gaps that could lose saved results and
-- give the owner a working full backup path. Apply after P0, P1 and P2.
--
-- This migration changes only triggers and functions. It does not update,
-- delete or rewrite any existing row; a final guard compares row counts and
-- content fingerprints of every protected table before commit.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '2min';

-- Hold writes for the few seconds the triggers are replaced so the guard
-- below compares a stable snapshot. Reads stay available.
lock table
  public.results, public.tools_results, public.rezultat_results, public.logis_results,
  public.sails_results, public.prim_results, public.candidate_profiles, public.candidate_activity,
  public.organizations, public.candidates, public.assessments, public.assessment_invites,
  public.assessment_evidence, public.assessment_reference_checks, public.outcome_followups,
  public.candidate_notes, public.audit_events
in share row exclusive mode;

create temporary table _evidencehire_p3_row_guard (
  table_name text primary key,
  row_count bigint not null,
  content_sha256 text not null
) on commit drop;

do $guard$
declare
  protected_table text;
  protected_count bigint;
  protected_hash text;
begin
  foreach protected_table in array array[
    'results', 'tools_results', 'rezultat_results', 'logis_results',
    'sails_results', 'prim_results', 'candidate_profiles', 'candidate_activity',
    'candidates', 'assessments', 'assessment_invites', 'assessment_evidence',
    'assessment_reference_checks', 'outcome_followups', 'candidate_notes', 'audit_events'
  ]
  loop
    if to_regclass(format('public.%I', protected_table)) is null then
      raise exception 'EvidenceHire P3 aborted: required table public.% is missing', protected_table;
    end if;
    execute format(
      'select count(*), encode(extensions.digest('
      'coalesce(string_agg(to_jsonb(source_row)::text, chr(10) '
      'order by to_jsonb(source_row)::text), ''''), '
      '''sha256''), ''hex'') from public.%I source_row',
      protected_table
    ) into protected_count, protected_hash;
    insert into _evidencehire_p3_row_guard values (protected_table, protected_count, protected_hash);
  end loop;
end
$guard$;

-- ---------------------------------------------------------------------------
-- 1. The two legacy 360 tables are listed in the data manifest but P0 made
--    only the six result tables append-only. Protect them the same way.
-- ---------------------------------------------------------------------------

do $legacy_360$
declare
  protected_table text;
begin
  foreach protected_table in array array['candidate_profiles', 'candidate_activity']
  loop
    execute format('drop trigger if exists evidencehire_block_legacy_delete on public.%I', protected_table);
    execute format(
      'create trigger evidencehire_block_legacy_delete '
      'before update or delete or truncate on public.%I for each statement '
      'execute function app_private.block_legacy_result_mutation()',
      protected_table
    );
  end loop;
end
$legacy_360$;

-- ---------------------------------------------------------------------------
-- 2. New results: no hard deletion of any evidence-bearing CRM table.
--    Candidates and assessments are already protected by P0.
-- ---------------------------------------------------------------------------

do $crm_no_delete$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'organizations', 'assessment_invites', 'assessment_evidence',
    'assessment_reference_checks', 'outcome_followups', 'candidate_notes', 'audit_events'
  ]
  loop
    execute format('drop trigger if exists evidencehire_block_record_delete on public.%I', protected_table);
    execute format(
      'create trigger evidencehire_block_record_delete '
      'before delete or truncate on public.%I for each statement '
      'execute function app_private.block_hiring_record_deletion()',
      protected_table
    );
  end loop;
end
$crm_no_delete$;

-- A submitted candidate answer is the primary evidence of a new assessment.
-- Only the first-open timestamp may still be set after submission.
create or replace function app_private.protect_submitted_candidate_response()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if old.submitted_at is not null and (
    new.candidate_response is distinct from old.candidate_response
    or new.submitted_at is distinct from old.submitted_at
    or new.consent_at is distinct from old.consent_at
    or new.consent_notice is distinct from old.consent_notice
    or new.assessment_id is distinct from old.assessment_id
    or new.organization_id is distinct from old.organization_id
  ) then
    raise exception 'A submitted candidate response is immutable' using errcode = '55000';
  end if;
  return new;
end
$function$;

revoke all on function app_private.protect_submitted_candidate_response()
  from public, anon, authenticated, service_role;

drop trigger if exists evidencehire_protect_submitted_response on public.assessment_invites;
create trigger evidencehire_protect_submitted_response
before update on public.assessment_invites
for each row execute function app_private.protect_submitted_candidate_response();

-- ---------------------------------------------------------------------------
-- 3. Block DROP TABLE on protected tables. Event triggers need elevated
--    rights; if the project does not allow them the migration continues and
--    reports a notice instead of failing.
-- ---------------------------------------------------------------------------

create or replace function app_private.block_protected_table_drop()
returns event_trigger
language plpgsql
set search_path = pg_catalog
as $function$
declare
  dropped record;
begin
  for dropped in select * from pg_event_trigger_dropped_objects()
  loop
    if dropped.object_type = 'table'
       and dropped.schema_name = 'public'
       and dropped.object_name in (
         'results', 'tools_results', 'rezultat_results', 'logis_results',
         'sails_results', 'prim_results', 'candidate_profiles', 'candidate_activity',
         'organizations', 'candidates', 'assessments', 'assessment_invites',
         'assessment_evidence', 'assessment_reference_checks', 'outcome_followups',
         'candidate_notes', 'audit_events'
       ) then
      raise exception 'Dropping protected table public.% is disabled', dropped.object_name
        using errcode = '55000';
    end if;
  end loop;
end
$function$;

revoke all on function app_private.block_protected_table_drop()
  from public, anon, authenticated, service_role;

do $drop_guard$
begin
  begin
    execute 'drop event trigger if exists evidencehire_block_protected_drop';
    execute 'create event trigger evidencehire_block_protected_drop on sql_drop '
      'execute function app_private.block_protected_table_drop()';
  exception when insufficient_privilege or feature_not_supported then
    raise notice 'EvidenceHire P3: event trigger not permitted here; table-drop guard skipped';
  end;
end
$drop_guard$;

-- ---------------------------------------------------------------------------
-- 4. Owner-only integrity report and full logical export.
-- ---------------------------------------------------------------------------

create or replace function app_private.require_owner_org()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_org uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select m.organization_id into caller_org
  from public.organization_members m
  where m.user_id = caller_id and m.role::text = 'owner'
  limit 1;
  if caller_org is null then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return caller_org;
end
$function$;

revoke all on function app_private.require_owner_org() from public, anon, authenticated, service_role;

create or replace function public.get_data_integrity_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_org uuid := app_private.require_owner_org();
  protected_table text;
  row_count bigint;
  content_hash text;
  legacy jsonb := '{}'::jsonb;
  current_data jsonb := '{}'::jsonb;
begin
  -- Legacy tables: the same ordered digest as docs/plan/LEGACY_DATA_MANIFEST.md.
  foreach protected_table in array array[
    'results', 'tools_results', 'rezultat_results', 'logis_results',
    'sails_results', 'prim_results', 'candidate_profiles', 'candidate_activity'
  ]
  loop
    execute format(
      'select count(*), encode(extensions.digest('
      'coalesce(string_agg(to_jsonb(source_row)::text, chr(10) '
      'order by to_jsonb(source_row)::text), ''''), '
      '''sha256''), ''hex'') from public.%I source_row',
      protected_table
    ) into row_count, content_hash;
    legacy := legacy || jsonb_build_object(protected_table, jsonb_build_object('rows', row_count, 'sha256', content_hash));
  end loop;

  foreach protected_table in array array[
    'candidates', 'assessments', 'assessment_invites', 'assessment_evidence',
    'assessment_reference_checks', 'outcome_followups', 'candidate_notes', 'audit_events'
  ]
  loop
    execute format('select count(*) from public.%I where organization_id = $1', protected_table)
      into row_count using caller_org;
    current_data := current_data || jsonb_build_object(protected_table, row_count);
  end loop;

  current_data := current_data || jsonb_build_object(
    'submitted_candidate_responses',
    (select count(*) from public.assessment_invites i where i.organization_id = caller_org and i.submitted_at is not null)
  );

  return jsonb_build_object(
    'checkedAt', now(),
    'organizationId', caller_org,
    'legacy', legacy,
    'current', current_data
  );
end
$function$;

create or replace function public.export_owner_backup()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_org uuid := app_private.require_owner_org();
  protected_table text;
  table_rows jsonb;
  tables jsonb := '{}'::jsonb;
begin
  -- Legacy archive: whole tables, including the owner-only rows without branch.
  foreach protected_table in array array[
    'results', 'tools_results', 'rezultat_results', 'logis_results',
    'sails_results', 'prim_results', 'candidate_profiles', 'candidate_activity'
  ]
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(source_row) order by to_jsonb(source_row)::text), ''[]''::jsonb) '
      'from public.%I source_row',
      protected_table
    ) into table_rows;
    tables := tables || jsonb_build_object(protected_table, table_rows);
  end loop;

  -- Current hiring CRM of the owner's organization.
  foreach protected_table in array array[
    'organization_members', 'organization_member_branches', 'job_profiles',
    'candidates', 'assessments', 'assessment_evidence', 'assessment_reference_checks',
    'outcome_followups', 'candidate_notes', 'audit_events'
  ]
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(source_row) order by to_jsonb(source_row)::text), ''[]''::jsonb) '
      'from public.%I source_row where organization_id = $1',
      protected_table
    ) into table_rows using caller_org;
    tables := tables || jsonb_build_object(protected_table, table_rows);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into table_rows
  from public.organizations o where o.id = caller_org;
  tables := tables || jsonb_build_object('organizations', table_rows);

  -- Candidate invitations without the capability-token hash.
  select coalesce(jsonb_agg(to_jsonb(i) - 'token_hash' order by i.created_at, i.id), '[]'::jsonb) into table_rows
  from public.assessment_invites i where i.organization_id = caller_org;
  tables := tables || jsonb_build_object('assessment_invites', table_rows);

  if to_regclass('public.hiring_audit_log') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(l) order by l.id), ''[]''::jsonb) '
      'from public.hiring_audit_log l where l.organization_id = $1'
      into table_rows using caller_org;
    tables := tables || jsonb_build_object('hiring_audit_log', table_rows);
  end if;

  insert into public.audit_events(organization_id, actor_id, event_type, entity_type, metadata)
  values (caller_org, (select auth.uid()), 'owner_backup_exported', 'organization', '{}'::jsonb);

  return jsonb_build_object(
    'format', 'evidencehire-full-v1',
    'createdAt', now(),
    'organizationId', caller_org,
    'tables', tables
  );
end
$function$;

revoke all on function public.get_data_integrity_report() from public, anon, authenticated, service_role;
revoke all on function public.export_owner_backup() from public, anon, authenticated, service_role;
grant execute on function public.get_data_integrity_report() to authenticated;
grant execute on function public.export_owner_backup() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Assert that every protected row survived this migration unchanged.
-- ---------------------------------------------------------------------------

do $final_guard$
declare
  protected_row record;
  current_count bigint;
  current_hash text;
begin
  for protected_row in select * from _evidencehire_p3_row_guard
  loop
    execute format(
      'select count(*), encode(extensions.digest('
      'coalesce(string_agg(to_jsonb(source_row)::text, chr(10) '
      'order by to_jsonb(source_row)::text), ''''), '
      '''sha256''), ''hex'') from public.%I source_row',
      protected_row.table_name
    ) into current_count, current_hash;
    if current_count <> protected_row.row_count
       or current_hash is distinct from protected_row.content_sha256 then
      raise exception 'EvidenceHire P3 aborted: public.% changed during migration', protected_row.table_name;
    end if;
  end loop;
end
$final_guard$;

commit;

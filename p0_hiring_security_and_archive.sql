-- EvidenceHire P0 security and data-preservation migration.
--
-- Apply only after the Vercel server-side Supabase proxy is deployed with a
-- service-role key. Historical candidate/result rows are never rewritten or
-- removed; only the retired custom-admin credential fields are randomized.
-- A final row-count assertion must pass before the migration can succeed.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '3min';

create extension if not exists pgcrypto with schema extensions;

-- Supabase 2026 no longer guarantees implicit Data API grants. Make the safe
-- behavior explicit for every future object created by the postgres owner.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences
  from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions
  from public, anon, authenticated, service_role;

-- Hold a consistent snapshot while public result writes are being moved from
-- direct Data API access to the server-side insert-only endpoint.
lock table
  public.admins,
  public.results,
  public.tools_results,
  public.rezultat_results,
  public.logis_results,
  public.sails_results,
  public.prim_results,
  public.candidate_profiles,
  public.candidate_activity
in access exclusive mode;

-- Capture the protected row counts before any DDL. The table is temporary and
-- exists only for this migration session.
create temporary table _evidencehire_p0_row_guard (
  table_name text primary key,
  row_count bigint not null,
  content_sha256 text
) on commit drop;

do $guard$
declare
  protected_table text;
  protected_count bigint;
  protected_hash text;
begin
  foreach protected_table in array array[
    'admins',
    'results',
    'tools_results',
    'rezultat_results',
    'logis_results',
    'sails_results',
    'prim_results',
    'candidate_profiles',
    'candidate_activity'
  ]
  loop
    if to_regclass(format('public.%I', protected_table)) is null then
      raise exception 'EvidenceHire P0 aborted: required table public.% is missing', protected_table;
    end if;

    execute format('select count(*) from public.%I', protected_table)
      into protected_count;

    -- Admin credential fields are intentionally randomized below. Every other
    -- protected table receives a content fingerprint as well as a row count.
    if protected_table = 'admins' then
      protected_hash := null;
    else
      execute format(
        'select encode(extensions.digest('
        'coalesce(string_agg(to_jsonb(source_row)::text, chr(10) '
        'order by to_jsonb(source_row)::text), ''''), '
        '''sha256''), ''hex'') from public.%I source_row',
        protected_table
      ) into protected_hash;
    end if;

    insert into _evidencehire_p0_row_guard(table_name, row_count, content_sha256)
      values (protected_table, protected_count, protected_hash);
  end loop;
end
$guard$;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Make the historical archive private and append-only.
-- ---------------------------------------------------------------------------

do $legacy_access$
declare
  protected_table text;
  existing_policy record;
begin
  foreach protected_table in array array[
    'admins',
    'results',
    'tools_results',
    'rezultat_results',
    'logis_results',
    'sails_results',
    'prim_results',
    'candidate_profiles',
    'candidate_activity'
  ]
  loop
    execute format('alter table public.%I enable row level security', protected_table);

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = protected_table
    loop
      execute format(
        'drop policy %I on public.%I',
        existing_policy.policyname,
        protected_table
      );
    end loop;

    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      protected_table
    );
  end loop;
end
$legacy_access$;

-- Legacy results are available read-only to the trusted Vercel archive proxy.
-- All new candidate submissions use capability-token RPCs and the new CRM.
grant select on table
  public.results,
  public.tools_results,
  public.rezultat_results,
  public.logis_results,
  public.sails_results,
  public.prim_results
to service_role;

-- Identity/serial defaults are a separate privilege layer from table grants.
do $legacy_sequences$
declare
  protected_table text;
  sequence_name text;
begin
  foreach protected_table in array array[
    'results',
    'tools_results',
    'rezultat_results',
    'logis_results',
    'sails_results',
    'prim_results'
  ]
  loop
    sequence_name := pg_get_serial_sequence(format('public.%I', protected_table), 'id');
    if sequence_name is not null then
      execute format('revoke all on sequence %s from public, anon, authenticated, service_role', sequence_name);
    end if;
  end loop;
end
$legacy_sequences$;

-- These two tables remain readable to the trusted proxy for a future unified
-- archive, but no browser role can read or mutate them.
grant select on table
  public.candidate_profiles,
  public.candidate_activity
to service_role;

-- Legacy custom-password login has been retired (`/api/auth` returns 410).
-- Keep the admin rows, logins and branch mappings for audit/history, while
-- replacing every reusable credential with a unique unusable random marker.
alter table public.admins
  add column if not exists password_hash text;
update public.admins
set password = 'retired-' || encode(extensions.gen_random_bytes(16), 'hex'),
    password_hash = null
where password not like 'retired-%'
   or password_hash is not null;

create or replace function app_private.block_legacy_result_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception 'Historical result table %.% is append-only', tg_table_schema, tg_table_name
    using errcode = '55000';
end
$function$;

revoke all on function app_private.block_legacy_result_mutation() from public, anon, authenticated, service_role;

do $legacy_triggers$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'results',
    'tools_results',
    'rezultat_results',
    'logis_results',
    'sails_results',
    'prim_results'
  ]
  loop
    execute format(
      'drop trigger if exists evidencehire_block_legacy_delete on public.%I',
      protected_table
    );
    execute format(
      'create trigger evidencehire_block_legacy_delete '
      'before update or delete or truncate on public.%I for each statement '
      'execute function app_private.block_legacy_result_mutation()',
      protected_table
    );
  end loop;
end
$legacy_triggers$;

-- ---------------------------------------------------------------------------
-- 2. Add reversible archiving and the fields used by the evidence workflow.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists retention_days integer not null default 365;

alter table public.candidates
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

alter table public.assessments
  add column if not exists profile_version integer not null default 1,
  add column if not exists profile_definition jsonb,
  add column if not exists candidate_modules text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

alter table public.assessment_invites
  add column if not exists opened_at timestamptz,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists consent_notice jsonb,
  add column if not exists revoked_at timestamptz;

alter table public.assessment_evidence
  add column if not exists submitted_at timestamptz;

-- Keep every historical method accepted while normalizing the canonical name
-- used by the new reference-check form.
alter table public.assessment_evidence
  drop constraint if exists assessment_evidence_method_check;
alter table public.assessment_evidence
  add constraint assessment_evidence_method_check
  check (method in (
    'structured_interview', 'work_sample', 'eligibility',
    'reference', 'structured_reference', 'other'
  ));

-- The live schema uses bytea token hashes. Older repository snapshots used a
-- 64-character hex string; normalize that representation without invalidating
-- any outstanding invitation.
do $token_hash_type$
declare
  current_type text;
begin
  select c.udt_name
    into current_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'assessment_invites'
    and c.column_name = 'token_hash';

  if current_type = 'text' then
    if exists (
      select 1
      from public.assessment_invites
      where token_hash !~ '^[0-9a-fA-F]{64}$'
    ) then
      raise exception 'EvidenceHire P0 aborted: an invitation has an invalid token hash';
    end if;
    if exists (
      select 1
      from public.assessment_invites
      group by decode(token_hash, 'hex')
      having count(*) > 1
    ) then
      raise exception 'EvidenceHire P0 aborted: invitation token hashes collide after normalization';
    end if;
    alter table public.assessment_invites
      alter column token_hash type bytea
      using decode(token_hash, 'hex');
  elsif current_type is distinct from 'bytea' then
    raise exception 'EvidenceHire P0 aborted: unsupported assessment_invites.token_hash type %', current_type;
  end if;
end
$token_hash_type$;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_retention_days_check'
  ) then
    alter table public.organizations
      add constraint organizations_retention_days_check
      check (retention_days between 30 and 3650);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_profile_definition_object_check'
  ) then
    alter table public.assessments
      add constraint assessments_profile_definition_object_check
      check (
        profile_definition is null
        or jsonb_typeof(profile_definition) = 'object'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidates'::regclass
      and conname = 'candidates_archive_reason_check'
  ) then
    alter table public.candidates
      add constraint candidates_archive_reason_check
      check (
        archived_at is null
        or (
          archive_reason is not null
          and char_length(btrim(archive_reason)) between 2 and 500
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_profile_version_check'
  ) then
    alter table public.assessments
      add constraint assessments_profile_version_check
      check (profile_version > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_archive_reason_check'
  ) then
    alter table public.assessments
      add constraint assessments_archive_reason_check
      check (
        archived_at is null
        or (
          archive_reason is not null
          and char_length(btrim(archive_reason)) between 2 and 500
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_candidate_modules_check'
  ) then
    alter table public.assessments
      add constraint assessments_candidate_modules_check
      check (
        candidate_modules <@ array['work_preferences_fc']::text[]
        and cardinality(candidate_modules) <= 1
      );
  end if;
end
$constraints$;

-- New records use the compact eight-stage workflow. The older stage values
-- remain accepted so applying this migration can never invalidate a CRM row
-- that may have been created immediately before rollout.
alter table public.assessments
  drop constraint if exists assessments_pipeline_stage_check;
alter table public.assessments
  add constraint assessments_pipeline_stage_check
  check (pipeline_stage in (
    'new', 'assignment', 'interview', 'decision',
    'offer', 'hired', 'reserve', 'declined',
    'contact', 'screening', 'testing', 'work_sample', 'references'
  ));

-- Keep the live historical spelling accepted, while new hiring profiles move
-- directly from draft to a locally reviewed pilot.
alter table public.job_profiles
  drop constraint if exists job_profiles_status_check;
alter table public.job_profiles
  add constraint job_profiles_status_check
  check (status in ('draft', 'expert_review', 'expert_reviewed', 'pilot', 'validated', 'archived'));

alter table public.job_profiles
  drop constraint if exists job_profiles_definition_identity_check;
alter table public.job_profiles
  add constraint job_profiles_definition_identity_check
  check (
    jsonb_typeof(definition) = 'object'
    and coalesce(definition ->> 'id', '') = slug
    and coalesce(definition ->> 'version', '') = version::text
    and coalesce(definition ->> 'status', '') = status::text
  );

alter table public.assessment_invites
  drop constraint if exists assessment_invites_consent_notice_object_check;
alter table public.assessment_invites
  add constraint assessment_invites_consent_notice_object_check
  check (consent_notice is null or jsonb_typeof(consent_notice) = 'object');

create index if not exists candidates_active_org_branch_created_idx
  on public.candidates(organization_id, branch_id, created_at desc)
  where archived_at is null;
create index if not exists assessments_active_org_branch_stage_idx
  on public.assessments(organization_id, branch_id, pipeline_stage, updated_at desc)
  where archived_at is null;

-- The live database already uses audit_events. Create it only for environments
-- that were bootstrapped from an older repository snapshot.
create table if not exists public.audit_events (
  id bigint generated by default as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_events
  add column if not exists branch_id text;
create index if not exists audit_events_org_branch_created_idx
  on public.audit_events(organization_id, branch_id, created_at desc);

-- One canonical assessment-level reference disposition. Keeping it outside the
-- general assessment row prevents interviewers from reading recommender PII.
create table if not exists public.assessment_reference_checks (
  assessment_id uuid primary key references public.assessments(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payload text not null default '' check (octet_length(payload) <= 20000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists assessment_reference_checks_org_updated_idx
  on public.assessment_reference_checks(organization_id, updated_at desc);

-- Preserve the reference notes written by the pre-canonical UI. The former
-- evidence rows stay untouched for audit; the newest summary only seeds a
-- missing assessment-level record. Drop a trigger left by an earlier version
-- so this migration remains safely re-runnable for assessments already offered.
drop trigger if exists protect_reference_check_trigger on public.assessment_reference_checks;
insert into public.assessment_reference_checks(
  assessment_id,
  organization_id,
  payload,
  updated_by,
  updated_at
)
select distinct on (e.assessment_id)
  e.assessment_id,
  a.organization_id,
  coalesce(e.notes, ''),
  e.rater_id,
  coalesce(e.updated_at, e.created_at, clock_timestamp())
from public.assessment_evidence e
join public.assessments a on a.id = e.assessment_id
where e.method in ('reference', 'structured_reference')
  and e.item_id = 'summary'
order by
  e.assessment_id,
  e.updated_at desc nulls last,
  e.created_at desc nulls last,
  e.id desc
on conflict (assessment_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Central authorization helpers with strict branch semantics.
-- ---------------------------------------------------------------------------

create or replace function public.is_organization_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization
      and m.user_id = (select auth.uid())
  )
$function$;

create or replace function public.has_organization_role(
  target_organization uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization
      and m.user_id = (select auth.uid())
      and m.role::text = any(allowed_roles)
  )
$function$;

create or replace function public.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select public.has_organization_role(target_org, array['owner'])
$function$;

create or replace function public.can_access_branch(target_org uuid, target_branch text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and (
        m.role::text = 'owner'
        or (
          target_branch is not null
          and (
            m.branch_id = target_branch
            or exists (
              select 1
              from public.organization_member_branches b
              where b.organization_id = m.organization_id
                and b.user_id = m.user_id
                and b.branch_id = target_branch
            )
          )
        )
      )
  )
$function$;

create or replace function public.can_access_assessment(target_assessment uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.assessments a
    where a.id = target_assessment
      and public.can_access_branch(a.organization_id, a.branch_id)
  )
$function$;

create or replace function public.can_edit_assessment(target_assessment uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.assessments a
    join public.candidates c on c.id = a.candidate_id
    where a.id = target_assessment
      and a.archived_at is null
      and c.archived_at is null
      and public.can_access_branch(a.organization_id, a.branch_id)
      and public.has_organization_role(
        a.organization_id,
        array['owner', 'admin', 'interviewer']
      )
  )
$function$;

create or replace function public.can_manage_assessment(target_assessment uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.assessments a
    where a.id = target_assessment
      and public.can_access_branch(a.organization_id, a.branch_id)
      and public.has_organization_role(a.organization_id, array['owner', 'admin'])
  )
$function$;

create or replace function public.can_manage_active_assessment(target_assessment uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.assessments a
    join public.candidates c on c.id = a.candidate_id
    where a.id = target_assessment
      and a.archived_at is null
      and c.archived_at is null
      and public.can_access_branch(a.organization_id, a.branch_id)
      and public.has_organization_role(a.organization_id, array['owner', 'admin'])
  )
$function$;

create or replace function public.assessment_belongs_to_org(
  target_assessment uuid,
  target_organization uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.assessments a
    where a.id = target_assessment
      and a.organization_id = target_organization
  )
$function$;

create or replace function public.has_submitted_assessment_evidence(target_assessment uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.assessment_evidence e
    where e.assessment_id = target_assessment
      and e.rater_id = (select auth.uid())
      and e.method in ('structured_interview', 'work_sample')
      and e.submitted_at is not null
  )
$function$;

revoke all on function public.is_organization_member(uuid) from public, anon, authenticated;
revoke all on function public.has_organization_role(uuid, text[]) from public, anon, authenticated;
revoke all on function public.is_org_owner(uuid) from public, anon, authenticated;
revoke all on function public.can_access_branch(uuid, text) from public, anon, authenticated;
revoke all on function public.can_access_assessment(uuid) from public, anon, authenticated;
revoke all on function public.can_edit_assessment(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_assessment(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_active_assessment(uuid) from public, anon, authenticated;
revoke all on function public.assessment_belongs_to_org(uuid, uuid) from public, anon, authenticated;
revoke all on function public.has_submitted_assessment_evidence(uuid) from public, anon, authenticated;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid, text) to authenticated;
grant execute on function public.can_access_assessment(uuid) to authenticated;
grant execute on function public.can_edit_assessment(uuid) to authenticated;
grant execute on function public.can_manage_assessment(uuid) to authenticated;
grant execute on function public.can_manage_active_assessment(uuid) to authenticated;
grant execute on function public.assessment_belongs_to_org(uuid, uuid) to authenticated;
grant execute on function public.has_submitted_assessment_evidence(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rebuild CRM grants and RLS from a deny-by-default baseline.
-- ---------------------------------------------------------------------------

do $crm_policies$
declare
  protected_table text;
  existing_policy record;
begin
  foreach protected_table in array array[
    'organizations',
    'organization_members',
    'organization_member_branches',
    'job_profiles',
    'candidates',
    'assessments',
    'assessment_evidence',
    'assessment_reference_checks',
    'assessment_invites',
    'outcome_followups',
    'candidate_notes',
    'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', protected_table);

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = protected_table
    loop
      execute format(
        'drop policy %I on public.%I',
        existing_policy.policyname,
        protected_table
      );
    end loop;

    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      protected_table
    );
  end loop;
end
$crm_policies$;

grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.organization_member_branches to authenticated;
grant select, insert, update on table public.job_profiles to authenticated;
grant select on table public.candidates to authenticated;
grant update (full_name, email, retention_until) on table public.candidates to authenticated;
grant select on table public.assessments to authenticated;
grant update (
  status,
  final_decision,
  decision_reason,
  pipeline_stage,
  next_action,
  next_action_at,
  rejection_reason,
  source,
  updated_at
) on table public.assessments to authenticated;
grant select, insert, update on table public.assessment_evidence to authenticated;
grant select on table public.assessment_reference_checks to authenticated;
grant select on table public.assessment_invites to authenticated;
grant select, insert, update on table public.outcome_followups to authenticated;
grant select, insert on table public.candidate_notes to authenticated;
grant select on table public.audit_events to authenticated;

revoke all on sequence public.audit_events_id_seq from public, anon, authenticated, service_role;

create policy "members read organizations"
on public.organizations for select to authenticated
using (public.is_organization_member(id));

create policy "owners update organizations"
on public.organizations for update to authenticated
using (public.is_org_owner(id))
with check (public.is_org_owner(id));

create policy "members read own membership"
on public.organization_members for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_owner(organization_id)
);

create policy "owners insert memberships"
on public.organization_members for insert to authenticated
with check (public.is_org_owner(organization_id));

create policy "owners update memberships"
on public.organization_members for update to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy "owners delete memberships"
on public.organization_members for delete to authenticated
using (public.is_org_owner(organization_id));

create policy "members read own branch grants"
on public.organization_member_branches for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_owner(organization_id)
);

create policy "owners insert branch grants"
on public.organization_member_branches for insert to authenticated
with check (public.is_org_owner(organization_id));

create policy "owners update branch grants"
on public.organization_member_branches for update to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy "owners delete branch grants"
on public.organization_member_branches for delete to authenticated
using (public.is_org_owner(organization_id));

create policy "members read job profiles"
on public.job_profiles for select to authenticated
using (public.is_organization_member(organization_id));

create policy "owners insert job profiles"
on public.job_profiles for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner'])
  and created_by = (select auth.uid())
);

create policy "owners update job profiles"
on public.job_profiles for update to authenticated
using (public.has_organization_role(organization_id, array['owner']))
with check (public.has_organization_role(organization_id, array['owner']));

create policy "branch members read candidates"
on public.candidates for select to authenticated
using (public.can_access_branch(organization_id, branch_id));

create policy "branch admins update active candidates"
on public.candidates for update to authenticated
using (
  archived_at is null
  and public.can_access_branch(organization_id, branch_id)
  and public.has_organization_role(organization_id, array['owner', 'admin'])
)
with check (
  archived_at is null
  and public.can_access_branch(organization_id, branch_id)
  and public.has_organization_role(organization_id, array['owner', 'admin'])
);

create policy "branch members read assessments"
on public.assessments for select to authenticated
using (public.can_access_branch(organization_id, branch_id));

create policy "staff update active assessments"
on public.assessments for update to authenticated
using (
  archived_at is null
  and public.can_edit_assessment(id)
)
with check (
  archived_at is null
  and public.can_edit_assessment(id)
);

create policy "raters read permitted evidence"
on public.assessment_evidence for select to authenticated
using (
  public.can_access_assessment(assessment_id)
  and (
    rater_id = (select auth.uid())
    or (
      method in ('reference', 'structured_reference')
      and public.can_manage_assessment(assessment_id)
    )
    or (
      submitted_at is not null
      and public.can_manage_assessment(assessment_id)
      and (
        (
          public.is_org_owner(organization_id)
          and public.assessment_belongs_to_org(assessment_id, organization_id)
        )
        or public.has_submitted_assessment_evidence(assessment_id)
      )
    )
  )
);

create policy "raters insert own evidence"
on public.assessment_evidence for insert to authenticated
with check (
  rater_id = (select auth.uid())
  and submitted_at is null
  and (
    (method in ('reference', 'structured_reference') and public.can_manage_active_assessment(assessment_id))
    or (method not in ('reference', 'structured_reference') and public.can_edit_assessment(assessment_id))
  )
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "raters update own evidence"
on public.assessment_evidence for update to authenticated
using (
  rater_id = (select auth.uid())
  and submitted_at is null
  and (
    (method in ('reference', 'structured_reference') and public.can_manage_active_assessment(assessment_id))
    or (method not in ('reference', 'structured_reference') and public.can_edit_assessment(assessment_id))
  )
)
with check (
  rater_id = (select auth.uid())
  and submitted_at is null
  and (
    (method in ('reference', 'structured_reference') and public.can_manage_active_assessment(assessment_id))
    or (method not in ('reference', 'structured_reference') and public.can_edit_assessment(assessment_id))
  )
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch admins read canonical references"
on public.assessment_reference_checks for select to authenticated
using (
  public.can_manage_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "staff read branch invites"
on public.assessment_invites for select to authenticated
using (
  public.can_access_assessment(assessment_id)
  and public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'interviewer']
  )
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch admins read outcomes"
on public.outcome_followups for select to authenticated
using (
  public.can_manage_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch admins insert outcomes"
on public.outcome_followups for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and public.can_manage_active_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch admins update outcomes"
on public.outcome_followups for update to authenticated
using (
  public.can_manage_active_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
)
with check (
  recorded_by = (select auth.uid())
  and public.can_manage_active_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch members read candidate notes"
on public.candidate_notes for select to authenticated
using (
  public.can_access_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch staff insert candidate notes"
on public.candidate_notes for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.can_edit_assessment(assessment_id)
  and public.assessment_belongs_to_org(assessment_id, organization_id)
);

create policy "branch admins read audit"
on public.audit_events for select to authenticated
using (
  public.is_org_owner(organization_id)
  or (
    branch_id is not null
    and public.has_organization_role(organization_id, array['admin'])
    and public.can_access_branch(organization_id, branch_id)
  )
);

-- ---------------------------------------------------------------------------
-- 5. Prevent hard deletion and protect the last owner of each organization.
-- ---------------------------------------------------------------------------

create or replace function app_private.block_hiring_record_deletion()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception 'Hard deletion is disabled for %.%; use archive RPCs', tg_table_schema, tg_table_name
    using errcode = '55000';
end
$function$;

revoke all on function app_private.block_hiring_record_deletion() from public, anon, authenticated, service_role;

drop trigger if exists evidencehire_block_candidate_delete on public.candidates;
create trigger evidencehire_block_candidate_delete
before delete or truncate on public.candidates
for each statement execute function app_private.block_hiring_record_deletion();

drop trigger if exists evidencehire_block_assessment_delete on public.assessments;
create trigger evidencehire_block_assessment_delete
before delete or truncate on public.assessments
for each statement execute function app_private.block_hiring_record_deletion();

create or replace function app_private.protect_last_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text, 0));

  if tg_op = 'DELETE' then
    if old.role::text = 'owner'
       and not exists (
         select 1
         from public.organization_members other_owner
         where other_owner.organization_id = old.organization_id
           and other_owner.user_id <> old.user_id
           and other_owner.role::text = 'owner'
       ) then
      raise exception 'An organization must retain at least one owner'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.role::text = 'owner'
     and (
       new.role::text <> 'owner'
       or new.organization_id <> old.organization_id
     )
     and not exists (
       select 1
       from public.organization_members other_owner
       where other_owner.organization_id = old.organization_id
         and other_owner.user_id <> old.user_id
         and other_owner.role::text = 'owner'
     ) then
    raise exception 'An organization must retain at least one owner'
      using errcode = '23514';
  end if;
  return new;
end
$function$;

revoke all on function app_private.protect_last_organization_owner() from public, anon, authenticated, service_role;

drop trigger if exists evidencehire_protect_last_owner on public.organization_members;
create trigger evidencehire_protect_last_owner
before update or delete on public.organization_members
for each row execute function app_private.protect_last_organization_owner();

-- A completed independent rating is immutable. Reference-check notes remain a
-- separate, editable post-interview record and are not part of this lock.
create or replace function app_private.protect_assessment_evidence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'INSERT' then
    if new.method in ('structured_interview', 'work_sample')
       and new.submitted_at is not null then
      raise exception 'Evidence must be inserted as a draft' using errcode = '23514';
    end if;
    if new.method in ('structured_interview', 'work_sample')
       and exists (
         select 1
         from public.assessment_evidence e
         where e.assessment_id = new.assessment_id
           and e.rater_id = new.rater_id
           and e.method in ('structured_interview', 'work_sample')
           and e.submitted_at is not null
       ) then
      raise exception 'Submitted evidence is immutable' using errcode = '55000';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.method in ('structured_interview', 'work_sample')
       and old.submitted_at is not null then
      raise exception 'Submitted evidence is immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.method in ('structured_interview', 'work_sample')
     and old.submitted_at is not null then
    raise exception 'Submitted evidence is immutable' using errcode = '55000';
  end if;
  if new.method in ('structured_interview', 'work_sample')
     and new.submitted_at is not null
     and (
       to_jsonb(new) - 'submitted_at' - 'updated_at'
       is distinct from
       to_jsonb(old) - 'submitted_at' - 'updated_at'
     ) then
    raise exception 'Evidence cannot change while being submitted' using errcode = '55000';
  end if;
  return new;
end
$function$;

revoke all on function app_private.protect_assessment_evidence()
  from public, anon, authenticated, service_role;

drop trigger if exists protect_assessment_evidence_trigger on public.assessment_evidence;
create trigger protect_assessment_evidence_trigger
before insert or update or delete on public.assessment_evidence
for each row execute function app_private.protect_assessment_evidence();

create or replace function app_private.reference_disposition_complete(raw_notes text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  payload jsonb;
  data jsonb;
  disposition text;
begin
  begin
    payload := raw_notes::jsonb;
  exception when others then
    return false;
  end;
  if payload ->> 'schema' <> 'evidencehire-reference-v1'
     or jsonb_typeof(payload -> 'data') <> 'object' then
    return false;
  end if;
  data := payload -> 'data';
  disposition := data ->> 'disposition';
  if disposition = 'completed' then
    return data ->> 'consentConfirmed' = 'true'
      and char_length(btrim(coalesce(data ->> 'recommenderNameRole', ''))) >= 5
      and char_length(btrim(coalesce(data ->> 'relationshipDates', ''))) >= 5
      and char_length(btrim(coalesce(data ->> 'answers', ''))) >= 20;
  end if;
  if disposition in ('unavailable', 'not_applicable') then
    return char_length(btrim(coalesce(data ->> 'unavailableReason', ''))) >= 10;
  end if;
  return false;
end
$function$;

revoke all on function app_private.reference_disposition_complete(text)
  from public, anon, authenticated, service_role;

create or replace function app_private.protect_reference_check()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assessment uuid := case when tg_op = 'DELETE' then old.assessment_id else new.assessment_id end;
begin
  if exists (
    select 1
    from public.assessments a
    where a.id = target_assessment
      and (
        a.final_decision = 'offer'
        or a.pipeline_stage in ('offer', 'hired')
      )
  ) then
    raise exception 'The reference disposition is frozen after an offer' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

revoke all on function app_private.protect_reference_check()
  from public, anon, authenticated, service_role;

drop trigger if exists protect_reference_check_trigger on public.assessment_reference_checks;
create trigger protect_reference_check_trigger
before insert or update or delete on public.assessment_reference_checks
for each row execute function app_private.protect_reference_check();

create or replace function app_private.protect_outcome_measurement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  frozen_kpi_definition text;
begin
  if tg_op = 'UPDATE'
     and (
       new.organization_id is distinct from old.organization_id
       or new.assessment_id is distinct from old.assessment_id
       or new.checkpoint_days is distinct from old.checkpoint_days
       or new.recorded_by is distinct from old.recorded_by
     ) then
    raise exception 'Outcome identity and attribution are immutable'
      using errcode = '55000';
  end if;

  select nullif(btrim(a.profile_definition #>> '{jobAnalysis,outcomeDefinition}'), '')
    into frozen_kpi_definition
  from public.assessments a
  where a.id = new.assessment_id;

  if frozen_kpi_definition is null then
    raise exception 'The profile snapshot has no predefined outcome measure' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(new.kpi_definition, '')), '') is distinct from frozen_kpi_definition then
    raise exception 'The KPI definition must match the frozen profile snapshot' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE'
     and char_length(btrim(coalesce(old.kpi_definition, ''))) > 0
     and new.kpi_definition is distinct from old.kpi_definition then
    raise exception 'The KPI definition is frozen after first save' using errcode = '23514';
  end if;
  if new.manager_rating is not null and new.manager_rating not in (1, 3, 5) then
    raise exception 'Manager rating must use anchor 1, 3 or 5' using errcode = '23514';
  end if;
  if new.kpi_value is not null
     and (
       char_length(btrim(coalesce(new.kpi_definition, ''))) < 20
       or char_length(btrim(coalesce(new.notes, ''))) < 20
     ) then
    raise exception 'A KPI value requires a frozen definition and comparable work context'
      using errcode = '23514';
  end if;
  return new;
end
$function$;

revoke all on function app_private.protect_outcome_measurement()
  from public, anon, authenticated, service_role;

revoke all on function app_private.protect_outcome_measurement()
  from public, anon, authenticated, service_role;

drop trigger if exists protect_outcome_measurement_trigger on public.outcome_followups;
create trigger protect_outcome_measurement_trigger
before insert or update on public.outcome_followups
for each row execute function app_private.protect_outcome_measurement();

-- Repair the live audit trigger so assessment updates cannot fail because an
-- older function still references the absent hiring_audit_log table.
create or replace function public.audit_assessment_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  insert into public.audit_events(
    organization_id,
    branch_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    new.organization_id,
    new.branch_id,
    (select auth.uid()),
    'assessment_updated',
    'assessment',
    new.id,
    jsonb_build_object(
      'stage_before', old.pipeline_stage,
      'stage_after', new.pipeline_stage,
      'decision_before', old.final_decision,
      'decision_after', new.final_decision,
      'archived_before', old.archived_at is not null,
      'archived_after', new.archived_at is not null
    )
  );
  return new;
end
$function$;

revoke all on function public.audit_assessment_change() from public, anon, authenticated, service_role;

drop trigger if exists assessment_audit_trigger on public.assessments;
drop trigger if exists assessment_audit_update on public.assessments;
create trigger assessment_audit_trigger
after update of pipeline_stage, final_decision, next_action, next_action_at, archived_at, archive_reason
on public.assessments
for each row execute function public.audit_assessment_change();

create or replace function public.protect_assessment_decision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.pipeline_stage is distinct from new.pipeline_stage
     and (
       old.pipeline_stage in ('decision', 'offer', 'hired', 'reserve', 'declined')
       or new.pipeline_stage in ('decision', 'offer', 'hired', 'reserve', 'declined')
     )
     and not public.can_manage_assessment(new.id) then
    raise exception 'Only an authorized branch owner or admin can set a decision stage'
      using errcode = '42501';
  end if;

  if old.status is distinct from new.status
     and (
       old.status in ('decision', 'closed')
       or new.status in ('decision', 'closed')
     )
     and not public.can_manage_assessment(new.id) then
    raise exception 'Only an authorized branch owner or admin can change decision status'
      using errcode = '42501';
  end if;

  if old.final_decision is distinct from new.final_decision
     or old.decision_reason is distinct from new.decision_reason then
    if new.archived_at is not null or not public.can_manage_assessment(new.id) then
      raise exception 'Only an authorized branch owner or admin can change the final decision'
        using errcode = '42501';
    end if;
    if new.final_decision is not null
       and char_length(btrim(coalesce(new.decision_reason, ''))) < 10 then
      raise exception 'A final decision requires a work-related reason of at least 10 characters'
        using errcode = '23514';
    end if;
  end if;

  if (
       old.pipeline_stage is distinct from new.pipeline_stage
       and new.pipeline_stage in ('decision', 'offer', 'hired', 'reserve', 'declined')
     )
     or (
       old.final_decision is distinct from new.final_decision
       and new.final_decision is not null
     )
     or (
       old.status is distinct from new.status
       and new.status in ('decision', 'closed')
     ) then
    if new.profile_definition is null
       or coalesce(new.profile_definition ->> 'status', '') not in ('pilot', 'validated') then
      raise exception 'A draft or missing profile cannot be used for a hiring decision'
        using errcode = '23514';
    end if;
    if (
      select count(distinct e.rater_id)
      from public.assessment_evidence e
      where e.assessment_id = new.id
        and e.method in ('structured_interview', 'work_sample')
        and e.submitted_at is not null
    ) < 2 then
      raise exception 'Two completed independent ratings are required for a hiring decision'
        using errcode = '23514';
    end if;
  end if;

  if (old.pipeline_stage is distinct from new.pipeline_stage
      or old.final_decision is distinct from new.final_decision)
     and new.pipeline_stage in ('offer', 'hired', 'reserve', 'declined') then
    if char_length(btrim(coalesce(new.decision_reason, ''))) < 10 then
      raise exception 'A terminal stage requires a work-related reason of at least 10 characters'
        using errcode = '23514';
    end if;
    if (new.pipeline_stage in ('offer', 'hired') and new.final_decision is distinct from 'offer')
       or (new.pipeline_stage = 'reserve' and new.final_decision is distinct from 'reserve')
       or (new.pipeline_stage = 'declined' and new.final_decision is distinct from 'decline') then
      raise exception 'Pipeline stage and final decision are inconsistent'
        using errcode = '23514';
    end if;
  end if;

  if (
       old.final_decision is distinct from new.final_decision
       and new.final_decision = 'offer'
     )
     or (
       old.pipeline_stage is distinct from new.pipeline_stage
       and new.pipeline_stage in ('offer', 'hired')
     ) then
    if not exists (
      select 1
      from public.assessment_reference_checks r
      where r.assessment_id = new.id
        and app_private.reference_disposition_complete(r.payload)
    ) then
      raise exception 'An offer requires a documented reference-check disposition'
        using errcode = '23514';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.protect_assessment_decision() from public, anon, authenticated, service_role;

drop trigger if exists protect_assessment_decision_trigger on public.assessments;
create trigger protect_assessment_decision_trigger
before update of final_decision, decision_reason, pipeline_stage, status on public.assessments
for each row execute function public.protect_assessment_decision();

-- ---------------------------------------------------------------------------
-- 6. Transactional HR RPCs and reversible archive operations.
-- ---------------------------------------------------------------------------

drop function if exists public.create_candidate_assessment(uuid, text, text, text, text, integer, text);
drop function if exists public.create_candidate_assessment(uuid, text, text, text, text, jsonb, integer, text);
drop function if exists public.create_candidate_assessment(uuid, text, text, text, text, jsonb, integer, text, text[]);
create function public.create_candidate_assessment(
  target_organization uuid,
  candidate_name text,
  candidate_email text,
  target_branch text,
  target_profile_key text,
  target_profile_definition jsonb,
  target_profile_version integer default 1,
  candidate_source text default null,
  target_candidate_modules text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  retention_period integer;
  created_candidate_id uuid;
  created_assessment_id uuid;
  assessment_created_at timestamptz;
  assessment_updated_at timestamptz;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if target_branch is null or target_branch not in (
    'klyachka_nvkz',
    'klyachka_krsk_center',
    'klyachka_krsk_vzlet',
    'jobs_design'
  ) then
    raise exception 'Unknown or missing branch' using errcode = '22023';
  end if;
  if not public.can_access_branch(target_organization, target_branch)
     or not public.has_organization_role(
       target_organization,
       array['owner', 'admin']
     ) then
    raise exception 'Branch access denied' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(candidate_name, ''))) not between 1 and 200 then
    raise exception 'Candidate name must contain 1 to 200 characters' using errcode = '22023';
  end if;
  if candidate_email is not null and (
    char_length(btrim(candidate_email)) > 320
    or btrim(candidate_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) then
    raise exception 'Candidate email is invalid' using errcode = '22023';
  end if;
  if target_profile_version is null or target_profile_version < 1 then
    raise exception 'Profile version must be positive' using errcode = '22023';
  end if;
  if target_profile_key is null
     or target_profile_key !~ '^[a-z0-9_:-]{2,100}$' then
    raise exception 'Profile key is invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(target_profile_definition) is distinct from 'object'
     or target_profile_definition ->> 'id' is distinct from target_profile_key
     or target_profile_definition ->> 'version' is distinct from target_profile_version::text
     or coalesce(target_profile_definition ->> 'status', '') not in ('pilot', 'validated')
     or jsonb_typeof(target_profile_definition -> 'interview') is distinct from 'array'
     or jsonb_typeof(target_profile_definition #> '{workSample,rubric}') is distinct from 'array'
     or jsonb_array_length(target_profile_definition -> 'interview') < 1
     or jsonb_array_length(target_profile_definition #> '{workSample,rubric}') < 1
     or jsonb_typeof(target_profile_definition -> 'jobAnalysis') is distinct from 'object'
     or coalesce(target_profile_definition #>> '{jobAnalysis,status}', '') <> 'owner_confirmed'
     or char_length(btrim(coalesce(target_profile_definition #>> '{jobAnalysis,reviewers}', ''))) < 20
     or char_length(btrim(coalesce(target_profile_definition #>> '{jobAnalysis,criticalTasks}', ''))) < 20
     or char_length(btrim(coalesce(target_profile_definition #>> '{jobAnalysis,criticalErrors}', ''))) < 20
     or char_length(btrim(coalesce(target_profile_definition #>> '{jobAnalysis,entryRequirements}', ''))) < 20
     or char_length(btrim(coalesce(target_profile_definition #>> '{jobAnalysis,outcomeDefinition}', ''))) < 20
     or coalesce(target_profile_definition #>> '{jobAnalysis,representativeSampleConfirmed}', 'false') <> 'true'
     or coalesce(target_profile_definition #>> '{jobAnalysis,anchorsConfirmed}', 'false') <> 'true'
     or coalesce(target_profile_definition #>> '{jobAnalysis,accommodationsConfirmed}', 'false') <> 'true'
     or octet_length(target_profile_definition::text) > 200000 then
    raise exception 'Profile definition is invalid or not approved for hiring' using errcode = '22023';
  end if;
  if (target_branch like 'jobs_%' and coalesce(target_profile_definition ->> 'school', '') not in ('jobs', 'all'))
     or (target_branch like 'klyachka_%' and coalesce(target_profile_definition ->> 'school', '') not in ('klyachka', 'all')) then
    raise exception 'Profile does not belong to the selected school' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.job_profiles p
    where p.organization_id = target_organization
      and p.slug = target_profile_key
      and p.version = target_profile_version
      and p.status::text in ('pilot', 'validated')
      and p.definition = target_profile_definition
  ) then
    raise exception 'Approved profile version was not found' using errcode = '42501';
  end if;
  if candidate_source is not null and char_length(candidate_source) > 200 then
    raise exception 'Candidate source is too long' using errcode = '22023';
  end if;
  if target_candidate_modules is null
     or not target_candidate_modules <@ array['work_preferences_fc']::text[]
     or cardinality(target_candidate_modules) > 1 then
    raise exception 'Candidate modules are invalid' using errcode = '22023';
  end if;

  select o.retention_days
    into retention_period
  from public.organizations o
  where o.id = target_organization;
  if retention_period is null then
    raise exception 'Organization not found' using errcode = '22023';
  end if;

  insert into public.candidates(
    organization_id,
    full_name,
    email,
    branch_id,
    consent_at,
    retention_until,
    created_by
  ) values (
    target_organization,
    btrim(candidate_name),
    nullif(lower(btrim(candidate_email)), ''),
    target_branch,
    null,
    current_date + retention_period,
    caller_id
  )
  returning id into created_candidate_id;

  insert into public.assessments(
    organization_id,
    candidate_id,
    profile_key,
    profile_version,
    profile_definition,
    candidate_modules,
    branch_id,
    pipeline_stage,
    source,
    created_by
  ) values (
    target_organization,
    created_candidate_id,
    target_profile_key,
    target_profile_version,
    target_profile_definition,
    target_candidate_modules,
    target_branch,
    'new',
    nullif(btrim(candidate_source), ''),
    caller_id
  )
  returning id, created_at, updated_at
    into created_assessment_id, assessment_created_at, assessment_updated_at;

  return jsonb_build_object(
    'assessment_id', created_assessment_id,
    'candidate_id', created_candidate_id,
    'created_at', assessment_created_at,
    'updated_at', assessment_updated_at
  );
end
$function$;

revoke all on function public.create_candidate_assessment(uuid, text, text, text, text, jsonb, integer, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.create_candidate_assessment(uuid, text, text, text, text, jsonb, integer, text, text[])
  to authenticated;

create or replace function public.set_assessment_candidate_modules(
  target_assessment uuid,
  target_modules text[]
)
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  target_org uuid;
  target_branch text;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if target_modules is null
     or not target_modules <@ array['work_preferences_fc']::text[]
     or cardinality(target_modules) > 1 then
    raise exception 'Candidate modules are invalid' using errcode = '22023';
  end if;

  select a.organization_id, a.branch_id
    into target_org, target_branch
  from public.assessments a
  where a.id = target_assessment
    and a.archived_at is null
    and a.pipeline_stage = 'new'
  for update;

  if target_org is null
     or not public.can_manage_active_assessment(target_assessment) then
    raise exception 'Assessment cannot be changed' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.assessment_invites i
    where i.assessment_id = target_assessment
  ) then
    raise exception 'Candidate modules are frozen after the first invite' using errcode = '55000';
  end if;

  update public.assessments
  set candidate_modules = target_modules,
      updated_at = now()
  where id = target_assessment;

  insert into public.audit_events(
    organization_id, branch_id, actor_id, event_type, entity_type, entity_id, metadata
  ) values (
    target_org, target_branch, caller_id, 'assessment_modules_changed',
    'assessment', target_assessment, jsonb_build_object('candidateModules', target_modules)
  );

  return target_modules;
end
$function$;

revoke all on function public.set_assessment_candidate_modules(uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.set_assessment_candidate_modules(uuid, text[]) to authenticated;

drop function if exists public.save_assessment_card(
  uuid, timestamptz, text, text, text, text, timestamptz, text, text, boolean, text
);
create function public.save_assessment_card(
  target_assessment uuid,
  expected_updated_at timestamptz,
  target_final_decision text,
  target_decision_reason text,
  target_pipeline_stage text,
  target_next_action text,
  target_next_action_at timestamptz,
  target_rejection_reason text,
  target_source text,
  reference_changed boolean,
  target_reference_check text
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_org uuid;
  current_updated_at timestamptz;
  target_archived_at timestamptz;
  saved_updated_at timestamptz;
begin
  select a.organization_id, a.updated_at, a.archived_at
    into target_org, current_updated_at, target_archived_at
  from public.assessments a
  where a.id = target_assessment
  for update;

  if target_org is null
     or target_archived_at is not null
     or not public.can_manage_active_assessment(target_assessment) then
    raise exception 'Assessment access denied' using errcode = '42501';
  end if;
  if expected_updated_at is null or current_updated_at is distinct from expected_updated_at then
    raise exception 'Assessment changed since it was opened' using errcode = '40001';
  end if;
  if reference_changed is true and octet_length(coalesce(target_reference_check, '')) > 20000 then
    raise exception 'Reference check is too long' using errcode = '22023';
  end if;

  if reference_changed is true then
    insert into public.assessment_reference_checks(
      assessment_id, organization_id, payload, updated_by, updated_at
    ) values (
      target_assessment,
      target_org,
      coalesce(target_reference_check, ''),
      (select auth.uid()),
      clock_timestamp()
    )
    on conflict (assessment_id) do update
    set payload = excluded.payload,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
  end if;

  update public.assessments a
  set final_decision = nullif(target_final_decision, ''),
      decision_reason = nullif(btrim(coalesce(target_decision_reason, '')), ''),
      status = case when nullif(target_final_decision, '') is null then 'assessment' else 'decision' end,
      pipeline_stage = target_pipeline_stage,
      next_action = nullif(btrim(coalesce(target_next_action, '')), ''),
      next_action_at = target_next_action_at,
      rejection_reason = nullif(btrim(coalesce(target_rejection_reason, '')), ''),
      source = nullif(btrim(coalesce(target_source, '')), ''),
      updated_at = clock_timestamp()
  where a.id = target_assessment
  returning a.updated_at into saved_updated_at;

  return saved_updated_at;
end
$function$;

revoke all on function public.save_assessment_card(
  uuid, timestamptz, text, text, text, text, timestamptz, text, text, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.save_assessment_card(
  uuid, timestamptz, text, text, text, text, timestamptz, text, text, boolean, text
) to authenticated;

drop function if exists public.submit_assessment_evidence(uuid);
create function public.submit_assessment_evidence(target_assessment uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  profile_doc jsonb;
  submission_time timestamptz;
  has_missing boolean;
  changed_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select a.profile_definition
    into profile_doc
  from public.assessments a
  join public.candidates c on c.id = a.candidate_id
  where a.id = target_assessment
    and a.archived_at is null
    and c.archived_at is null
    and public.can_edit_assessment(a.id)
  for update of a;

  if profile_doc is null then
    raise exception 'Assessment profile snapshot is unavailable' using errcode = '22023';
  end if;

  select max(e.submitted_at)
    into submission_time
  from public.assessment_evidence e
  where e.assessment_id = target_assessment
    and e.rater_id = caller_id
    and e.method in ('structured_interview', 'work_sample')
    and e.submitted_at is not null;
  if submission_time is not null then
    return submission_time;
  end if;

  with required_items as (
    select
      'structured_interview'::text as method,
      item ->> 'id' as item_id,
      true as requires_notes
    from jsonb_array_elements(profile_doc -> 'interview') x(item)
    where (item -> 'required') is distinct from 'false'::jsonb
    union all
    select
      'work_sample',
      item ->> 'id',
      false
    from jsonb_array_elements(profile_doc #> '{workSample,rubric}') x(item)
    where (item -> 'required') is distinct from 'false'::jsonb
  )
  select exists (
    select 1
    from required_items r
    left join public.assessment_evidence e
      on e.assessment_id = target_assessment
     and e.rater_id = caller_id
     and e.method = r.method
     and e.item_id = r.item_id
     and e.submitted_at is null
    where r.item_id is null
       or e.id is null
       or e.rating is null
       or e.rating not in (1, 3, 5)
       or (
         r.requires_notes
         and char_length(btrim(coalesce(e.notes, ''))) < 10
       )
  ) into has_missing;

  if has_missing
     or exists (
       select 1
       from public.assessment_evidence e
       where e.assessment_id = target_assessment
         and e.rater_id = caller_id
         and e.method in ('structured_interview', 'work_sample')
         and e.rating is not null
         and e.rating not in (1, 3, 5)
     )
     or not exists (
       select 1
       from public.assessment_evidence e
       where e.assessment_id = target_assessment
         and e.rater_id = caller_id
         and e.method = 'work_sample'
         and e.item_id = 'reviewer_notes'
         and char_length(btrim(coalesce(e.notes, ''))) >= 20
     )
     or not exists (
       select 1
       from public.assessment_evidence e
       where e.assessment_id = target_assessment
         and e.rater_id = caller_id
         and e.method = 'work_sample'
         and e.item_id = 'observer_attestation'
         and e.notes = 'confirmed'
     ) then
    raise exception 'Complete every anchored rating, factual note and observed-work confirmation'
      using errcode = '23514';
  end if;

  submission_time := now();
  update public.assessment_evidence e
  set submitted_at = submission_time,
      updated_at = submission_time
  where e.assessment_id = target_assessment
    and e.rater_id = caller_id
    and e.method in ('structured_interview', 'work_sample')
    and e.submitted_at is null;
  get diagnostics changed_count = row_count;
  if changed_count = 0 then
    raise exception 'No draft evidence was found' using errcode = '23514';
  end if;
  return submission_time;
end
$function$;

revoke all on function public.submit_assessment_evidence(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_assessment_evidence(uuid) to authenticated;

create or replace function public.archive_assessment(
  target_assessment uuid,
  reason_text text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  changed_count integer;
  normalized_reason text := coalesce(
    nullif(btrim(reason_text), ''),
    'Закрыто командой найма'
  );
begin
  if char_length(normalized_reason) not between 2 and 500 then
    raise exception 'Archive reason must contain 2 to 500 characters' using errcode = '22023';
  end if;

  update public.assessments a
  set archived_at = now(),
      archived_by = (select auth.uid()),
      archive_reason = normalized_reason,
      updated_at = now()
  where a.id = target_assessment
    and a.archived_at is null
    and public.can_manage_assessment(a.id);
  get diagnostics changed_count = row_count;
  return changed_count = 1;
end
$function$;

revoke all on function public.archive_assessment(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.archive_assessment(uuid, text) to authenticated;

create or replace function public.restore_assessment(target_assessment uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  changed_count integer;
begin
  update public.assessments a
  set archived_at = null,
      archived_by = null,
      archive_reason = null,
      updated_at = now()
  where a.id = target_assessment
    and a.archived_at is not null
    and public.can_manage_assessment(a.id)
    and exists (
      select 1
      from public.candidates c
      where c.id = a.candidate_id and c.archived_at is null
    );
  get diagnostics changed_count = row_count;
  return changed_count = 1;
end
$function$;

revoke all on function public.restore_assessment(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_assessment(uuid) to authenticated;

create or replace function public.archive_candidate(
  target_candidate uuid,
  reason_text text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  changed_count integer;
  target_org uuid;
  target_branch text;
  normalized_reason text := coalesce(
    nullif(btrim(reason_text), ''),
    'Закрыто командой найма'
  );
begin
  if char_length(normalized_reason) not between 2 and 500 then
    raise exception 'Archive reason must contain 2 to 500 characters' using errcode = '22023';
  end if;

  select c.organization_id, c.branch_id
    into target_org, target_branch
  from public.candidates c
  where c.id = target_candidate;

  if target_org is null
     or not public.can_access_branch(target_org, target_branch)
     or not public.has_organization_role(target_org, array['owner', 'admin']) then
    return false;
  end if;

  update public.candidates c
  set archived_at = now(),
      archived_by = (select auth.uid()),
      archive_reason = normalized_reason
  where c.id = target_candidate and c.archived_at is null;
  get diagnostics changed_count = row_count;

  if changed_count = 1 then
    insert into public.audit_events(
      organization_id, branch_id, actor_id, event_type, entity_type, entity_id, metadata
    ) values (
      target_org,
      target_branch,
      (select auth.uid()),
      'candidate_archived',
      'candidate',
      target_candidate,
      jsonb_build_object('reason', normalized_reason)
    );
  end if;
  return changed_count = 1;
end
$function$;

revoke all on function public.archive_candidate(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.archive_candidate(uuid, text) to authenticated;

create or replace function public.restore_candidate(target_candidate uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  changed_count integer;
  target_org uuid;
  target_branch text;
begin
  select c.organization_id, c.branch_id
    into target_org, target_branch
  from public.candidates c
  where c.id = target_candidate;

  if target_org is null
     or not public.can_access_branch(target_org, target_branch)
     or not public.has_organization_role(target_org, array['owner', 'admin']) then
    return false;
  end if;

  update public.candidates c
  set archived_at = null,
      archived_by = null,
      archive_reason = null
  where c.id = target_candidate and c.archived_at is not null;
  get diagnostics changed_count = row_count;

  if changed_count = 1 then
    insert into public.audit_events(
      organization_id, branch_id, actor_id, event_type, entity_type, entity_id
    ) values (
      target_org,
      target_branch,
      (select auth.uid()),
      'candidate_restored',
      'candidate',
      target_candidate
    );
  end if;
  return changed_count = 1;
end
$function$;

revoke all on function public.restore_candidate(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_candidate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Capability-token assignment RPCs. Only the anon role may call them.
-- ---------------------------------------------------------------------------

create or replace function public.create_assessment_invite(target_assessment uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  raw_token text;
  target_org uuid;
begin
  select a.organization_id
    into target_org
  from public.assessments a
  where a.id = target_assessment
    and a.archived_at is null
  for update;

  if target_org is null or not public.can_manage_active_assessment(target_assessment) then
    raise exception 'Assessment access denied' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.assessment_invites i
    where i.assessment_id = target_assessment
      and i.submitted_at is not null
  ) then
    raise exception 'The candidate has already submitted this assignment; create an explicit new assessment for a retake'
      using errcode = '23514';
  end if;

  update public.assessment_invites i
  set expires_at = now(), revoked_at = now()
  where i.assessment_id = target_assessment
    and i.submitted_at is null
    and i.revoked_at is null
    and i.expires_at > now();

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.assessment_invites(
    organization_id,
    assessment_id,
    token_hash,
    expires_at,
    created_by
  ) values (
    target_org,
    target_assessment,
    extensions.digest(raw_token, 'sha256'),
    now() + interval '7 days',
    (select auth.uid())
  );

  update public.assessments
  set pipeline_stage = 'assignment', updated_at = now()
  where id = target_assessment and pipeline_stage = 'new';

  return raw_token;
end
$function$;

revoke all on function public.create_assessment_invite(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_assessment_invite(uuid) to authenticated;

-- PostgreSQL requires a drop/recreate to add output columns to a table-returning
-- function. This changes only the function definition, never candidate data.
drop function if exists public.get_candidate_assignment(text);
create function public.get_candidate_assignment(raw_token text)
returns table(
  assessment_id uuid,
  candidate_name text,
  profile_key text,
  profile_definition jsonb,
  candidate_response text,
  consent_at timestamptz,
  consent_notice jsonb,
  submitted_at timestamptz,
  expires_at timestamptz,
  branch_id text,
  candidate_modules text[],
  organization_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if raw_token is null or raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  update public.assessment_invites i
  set opened_at = coalesce(i.opened_at, now())
  where i.token_hash = extensions.digest(raw_token, 'sha256')
    and i.expires_at > now()
    and i.revoked_at is null
    and exists (
      select 1
      from public.assessments a
      join public.candidates c on c.id = a.candidate_id
      where a.id = i.assessment_id
        and a.archived_at is null
        and c.archived_at is null
    );

  return query
  select
    a.id,
    c.full_name,
    a.profile_key,
    coalesce(a.profile_definition, selected_profile.definition),
    i.candidate_response,
    i.consent_at,
    i.consent_notice,
    i.submitted_at,
    i.expires_at,
    a.branch_id,
    a.candidate_modules,
    o.name
  from public.assessment_invites i
  join public.assessments a on a.id = i.assessment_id
  join public.candidates c on c.id = a.candidate_id
  join public.organizations o on o.id = a.organization_id
  left join lateral (
    select p.definition
    from public.job_profiles p
    where p.organization_id = a.organization_id
      and p.slug = a.profile_key
      and p.version = a.profile_version
    limit 1
  ) selected_profile on true
  where i.token_hash = extensions.digest(raw_token, 'sha256')
    and i.expires_at > now()
    and i.revoked_at is null
    and a.archived_at is null
    and c.archived_at is null
  limit 1;
end
$function$;

revoke all on function public.get_candidate_assignment(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_candidate_assignment(text) to anon;

create or replace function app_private.candidate_response_is_valid(
  response_text text,
  candidate_modules text[],
  require_complete boolean
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $function$
declare
  payload jsonb;
  answers jsonb;
  answer_count integer;
  work_sample text;
begin
  if response_text is null or char_length(response_text) > 20000 then
    return false;
  end if;
  begin
    payload := response_text::jsonb;
  exception when others then
    return false;
  end;
  if jsonb_typeof(payload) is distinct from 'object'
     or payload ->> 'schema' is distinct from 'evidencehire-candidate-v1'
     or jsonb_typeof(payload -> 'screening') is distinct from 'object'
     or jsonb_typeof(payload -> 'workSample') is distinct from 'string' then
    return false;
  end if;
  work_sample := payload ->> 'workSample';
  if require_complete and (
    char_length(btrim(split_part(split_part(work_sample, '[КЛЮЧЕВЫЕ ДЕТАЛИ]', 1), E'\n', 2))) < 20
    or char_length(btrim(split_part(work_sample, '[ПРОВЕРКА РЕЗУЛЬТАТА]' || E'\n', 2))) < 1
  ) then
    return false;
  end if;
  if 'work_preferences_fc' = any(coalesce(candidate_modules, '{}')) then
    if jsonb_typeof(payload -> 'rolePreferences') is distinct from 'object'
       or payload #>> '{rolePreferences,schema}' is distinct from 'work-preferences-fc-legacy-166-v1'
       or payload #>> '{rolePreferences,itemBankSha256}' is distinct from '33c2f9e6f716b90029912db46899b6c02de82ea43f5d9a5ced9119986ec6ea1b'
       or jsonb_typeof(payload #> '{rolePreferences,answers}') is distinct from 'array' then
      return false;
    end if;
    answers := payload #> '{rolePreferences,answers}';
    answer_count := jsonb_array_length(answers);
    if (require_complete and answer_count <> 166)
       or (not require_complete and answer_count > 166)
       or exists (
         select 1
         from jsonb_array_elements(answers) as item(value)
         where jsonb_typeof(item.value) is distinct from 'string'
            or item.value #>> '{}' not in ('A', 'B')
       ) then
      return false;
    end if;
  end if;
  return true;
end
$function$;

revoke all on function app_private.candidate_response_is_valid(text, text[], boolean)
  from public, anon, authenticated, service_role;

drop function if exists public.save_candidate_assignment_draft(text, text);
drop function if exists public.save_candidate_assignment_draft(text, text, boolean);
drop function if exists public.save_candidate_assignment_draft(text, text, boolean, text);
create function public.save_candidate_assignment_draft(
  raw_token text,
  response_text text,
  consent_given boolean,
  notice_version text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  current_notice_version constant text := '2026-08-06-v1';
  changed_count integer;
  target_invite uuid;
  target_assessment uuid;
  target_candidate uuid;
  target_org uuid;
  target_branch text;
  previous_notice jsonb;
  previous_consent_at timestamptz;
  current_notice jsonb;
  target_modules text[];
begin
  if raw_token is null
     or raw_token !~ '^[0-9a-f]{64}$'
     or consent_given is not true
     or notice_version is distinct from current_notice_version
     or response_text is null then
    return false;
  end if;

  select
    i.id,
    i.assessment_id,
    a.candidate_id,
    a.organization_id,
    a.branch_id,
    a.candidate_modules,
    i.consent_notice,
    i.consent_at
  into
    target_invite,
    target_assessment,
    target_candidate,
    target_org,
    target_branch,
    target_modules,
    previous_notice,
    previous_consent_at
  from public.assessment_invites i
  join public.assessments a on a.id = i.assessment_id
  join public.candidates c on c.id = a.candidate_id
  where i.token_hash = extensions.digest(raw_token, 'sha256')
    and i.organization_id = a.organization_id
    and i.expires_at > now()
    and i.revoked_at is null
    and i.submitted_at is null
    and a.archived_at is null
    and c.archived_at is null
  for update of i;

  if target_invite is null then
    return false;
  end if;
  if not app_private.candidate_response_is_valid(response_text, target_modules, false) then
    return false;
  end if;

  current_notice := jsonb_build_object(
    'version', current_notice_version,
    'branchId', target_branch,
    'operator', case
      when target_branch = 'klyachka_nvkz' then 'ИП Васькина Юлия Андреевна'
      else 'ИП Воробьев Виталий Владимирович'
    end
  );

  if previous_consent_at is not null
     and coalesce(previous_notice ->> 'version', '') is distinct from current_notice_version then
    insert into public.audit_events(
      organization_id,
      branch_id,
      actor_id,
      event_type,
      entity_type,
      entity_id,
      metadata
    ) values (
      target_org,
      target_branch,
      null,
      'candidate_consent_notice_superseded',
      'assessment_invite',
      target_invite,
      jsonb_build_object(
        'previousConsentAt', previous_consent_at,
        'previousConsentNotice', previous_notice,
        'newNoticeVersion', current_notice_version
      )
    );
  end if;

  update public.assessment_invites i
  set candidate_response = response_text,
      consent_at = case
        when i.consent_at is not null
          and i.consent_notice ->> 'version' = current_notice_version
        then i.consent_at
        else now()
      end,
      consent_notice = current_notice,
      draft_updated_at = now()
  where i.id = target_invite;
  get diagnostics changed_count = row_count;
  if changed_count = 1 then
    update public.candidates c
    set consent_at = i.consent_at
    from public.assessment_invites i
    where i.id = target_invite
      and c.id = target_candidate;
  end if;
  return changed_count = 1;
end
$function$;

revoke all on function public.save_candidate_assignment_draft(text, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_candidate_assignment_draft(text, text, boolean, text) to anon;

drop function if exists public.submit_candidate_assignment(text, text, boolean);
drop function if exists public.submit_candidate_assignment(text, text, boolean, text);
create function public.submit_candidate_assignment(
  raw_token text,
  response_text text,
  consent_given boolean,
  notice_version text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  current_notice_version constant text := '2026-08-06-v1';
  changed_assessment uuid;
  target_invite uuid;
  target_candidate uuid;
  target_org uuid;
  target_branch text;
  previous_notice jsonb;
  previous_consent_at timestamptz;
  current_notice jsonb;
  target_modules text[];
begin
  if raw_token is null
     or raw_token !~ '^[0-9a-f]{64}$'
     or consent_given is not true
     or notice_version is distinct from current_notice_version
     or response_text is null then
    return false;
  end if;

  select
    i.id,
    i.assessment_id,
    a.candidate_id,
    a.organization_id,
    a.branch_id,
    a.candidate_modules,
    i.consent_notice,
    i.consent_at
  into
    target_invite,
    changed_assessment,
    target_candidate,
    target_org,
    target_branch,
    target_modules,
    previous_notice,
    previous_consent_at
  from public.assessment_invites i
  join public.assessments a on a.id = i.assessment_id
  join public.candidates c on c.id = a.candidate_id
  where i.token_hash = extensions.digest(raw_token, 'sha256')
    and i.organization_id = a.organization_id
    and i.expires_at > now()
    and i.revoked_at is null
    and i.submitted_at is null
    and a.archived_at is null
    and c.archived_at is null
  for update of i;

  if target_invite is null then
    return false;
  end if;
  if not app_private.candidate_response_is_valid(response_text, target_modules, true) then
    return false;
  end if;

  current_notice := jsonb_build_object(
    'version', current_notice_version,
    'branchId', target_branch,
    'operator', case
      when target_branch = 'klyachka_nvkz' then 'ИП Васькина Юлия Андреевна'
      else 'ИП Воробьев Виталий Владимирович'
    end
  );

  if previous_consent_at is not null
     and coalesce(previous_notice ->> 'version', '') is distinct from current_notice_version then
    insert into public.audit_events(
      organization_id,
      branch_id,
      actor_id,
      event_type,
      entity_type,
      entity_id,
      metadata
    ) values (
      target_org,
      target_branch,
      null,
      'candidate_consent_notice_superseded',
      'assessment_invite',
      target_invite,
      jsonb_build_object(
        'previousConsentAt', previous_consent_at,
        'previousConsentNotice', previous_notice,
        'newNoticeVersion', current_notice_version
      )
    );
  end if;

  update public.assessment_invites i
  set candidate_response = response_text,
      consent_at = case
        when i.consent_at is not null
          and i.consent_notice ->> 'version' = current_notice_version
        then i.consent_at
        else now()
      end,
      consent_notice = current_notice,
      submitted_at = now()
  where i.id = target_invite
  returning i.assessment_id into changed_assessment;

  if changed_assessment is null then
    return false;
  end if;

  update public.candidates c
  set consent_at = i.consent_at
  from public.assessment_invites i
  where i.id = target_invite
    and c.id = target_candidate;

  update public.assessments a
  set pipeline_stage = 'interview', updated_at = now()
  where a.id = changed_assessment and a.pipeline_stage = 'assignment';

  return true;
end
$function$;

revoke all on function public.submit_candidate_assignment(text, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_candidate_assignment(text, text, boolean, text) to anon;

-- Retain the historical function name for scheduled jobs, but make it archive
-- expired records instead of physically deleting them.
create or replace function public.purge_expired_candidates()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  archived_count integer;
begin
  update public.assessments a
  set archived_at = now(),
      archive_reason = 'Истёк срок хранения',
      updated_at = now()
  where a.archived_at is null
    and exists (
      select 1
      from public.candidates c
      where c.id = a.candidate_id
        and c.archived_at is null
        and c.retention_until is not null
        and c.retention_until < current_date
    );

  update public.candidates c
  set archived_at = now(),
      archive_reason = 'Истёк срок хранения'
  where c.archived_at is null
    and c.retention_until is not null
    and c.retention_until < current_date;
  get diagnostics archived_count = row_count;
  return archived_count;
end
$function$;

revoke all on function public.purge_expired_candidates()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Assert that every protected historical row survived this migration.
-- ---------------------------------------------------------------------------

do $final_guard$
declare
  protected_row record;
  current_count bigint;
  current_hash text;
begin
  for protected_row in
    select table_name, row_count, content_sha256
    from _evidencehire_p0_row_guard
  loop
    execute format('select count(*) from public.%I', protected_row.table_name)
      into current_count;
    if current_count <> protected_row.row_count then
      raise exception
        'EvidenceHire P0 aborted: public.% row count changed from % to %',
        protected_row.table_name,
        protected_row.row_count,
        current_count;
    end if;

    if protected_row.content_sha256 is not null then
      execute format(
        'select encode(extensions.digest('
        'coalesce(string_agg(to_jsonb(source_row)::text, chr(10) '
        'order by to_jsonb(source_row)::text), ''''), '
        '''sha256''), ''hex'') from public.%I source_row',
        protected_row.table_name
      ) into current_hash;
      if current_hash is distinct from protected_row.content_sha256 then
        raise exception
          'EvidenceHire P0 aborted: public.% content fingerprint changed',
          protected_row.table_name;
      end if;
    end if;
  end loop;

  if exists (
    select 1
    from public.admins
    where password not like 'retired-%'
       or password_hash is not null
  ) then
    raise exception 'EvidenceHire P0 aborted: a legacy admin credential was not retired';
  end if;

  if (
    select count(*) from public.admins
  ) <> (
    select count(distinct password) from public.admins
  ) then
    raise exception 'EvidenceHire P0 aborted: retired admin markers are not unique';
  end if;
end
$final_guard$;

commit;

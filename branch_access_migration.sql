-- EvidenceHire: филиальные доступы без изменения существующих результатов.
alter table public.organization_members add column if not exists branch_id text;
alter table public.candidates add column if not exists branch_id text;
alter table public.assessments add column if not exists branch_id text;

create or replace function public.can_access_branch(target_org uuid, target_branch text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id = target_org and m.user_id = auth.uid()
      and (m.role = 'owner' or m.branch_id is null or m.branch_id = target_branch)
  )
$$;
revoke all on function public.can_access_branch(uuid,text) from public, anon;
grant execute on function public.can_access_branch(uuid,text) to authenticated;

drop policy if exists "members read candidates" on public.candidates;
create policy "members read candidates" on public.candidates for select to authenticated
using (public.can_access_branch(organization_id, branch_id));
drop policy if exists "staff create candidates" on public.candidates;
create policy "staff create candidates" on public.candidates for insert to authenticated
with check (public.can_access_branch(organization_id, branch_id) and created_by = auth.uid());
drop policy if exists "admins update candidates" on public.candidates;
create policy "admins update candidates" on public.candidates for update to authenticated
using (public.can_access_branch(organization_id, branch_id))
with check (public.can_access_branch(organization_id, branch_id));
drop policy if exists "admins delete candidates" on public.candidates;
create policy "admins delete candidates" on public.candidates for delete to authenticated
using (public.can_access_branch(organization_id, branch_id));

drop policy if exists "members read assessments" on public.assessments;
create policy "members read assessments" on public.assessments for select to authenticated
using (public.can_access_branch(organization_id, branch_id));
drop policy if exists "staff create assessments" on public.assessments;
create policy "staff create assessments" on public.assessments for insert to authenticated
with check (public.can_access_branch(organization_id, branch_id) and created_by = auth.uid());
drop policy if exists "staff update assessments" on public.assessments;
create policy "staff update assessments" on public.assessments for update to authenticated
using (public.can_access_branch(organization_id, branch_id))
with check (public.can_access_branch(organization_id, branch_id));
drop policy if exists "admins delete assessments" on public.assessments;
create policy "admins delete assessments" on public.assessments for delete to authenticated
using (public.can_access_branch(organization_id, branch_id));

create or replace function public.can_access_assessment(target_assessment uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.assessments a
    where a.id = target_assessment
      and public.can_access_branch(a.organization_id, a.branch_id)
  )
$$;
revoke all on function public.can_access_assessment(uuid) from public, anon;
grant execute on function public.can_access_assessment(uuid) to authenticated;

create or replace function public.can_manage_assessment(target_assessment uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
    from public.assessments a
    join public.organization_members m on m.organization_id = a.organization_id
    where a.id = target_assessment
      and m.user_id = auth.uid()
      and m.role::text in ('owner','admin')
      and (m.role::text = 'owner' or m.branch_id is null or m.branch_id = a.branch_id)
  )
$$;
revoke all on function public.can_manage_assessment(uuid) from public, anon;
grant execute on function public.can_manage_assessment(uuid) to authenticated;

drop policy if exists "raters read own evidence" on public.assessment_evidence;
create policy "raters read own evidence" on public.assessment_evidence for select to authenticated
using (public.can_access_assessment(assessment_id) and (public.can_manage_assessment(assessment_id) or rater_id = auth.uid()));
drop policy if exists "raters create own evidence" on public.assessment_evidence;
create policy "raters create own evidence" on public.assessment_evidence for insert to authenticated
with check (public.can_access_assessment(assessment_id) and rater_id = auth.uid());
drop policy if exists "raters update own evidence" on public.assessment_evidence;
create policy "raters update own evidence" on public.assessment_evidence for update to authenticated
using (public.can_access_assessment(assessment_id) and rater_id = auth.uid())
with check (public.can_access_assessment(assessment_id) and rater_id = auth.uid());
drop policy if exists "admins delete evidence" on public.assessment_evidence;
create policy "admins delete evidence" on public.assessment_evidence for delete to authenticated
using (public.can_access_assessment(assessment_id) and (public.can_manage_assessment(assessment_id) or rater_id = auth.uid()));

create index if not exists candidates_org_branch_idx on public.candidates(organization_id, branch_id);
create index if not exists assessments_org_branch_idx on public.assessments(organization_id, branch_id);

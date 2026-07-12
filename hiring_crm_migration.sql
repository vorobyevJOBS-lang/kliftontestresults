-- EvidenceHire CRM: pipeline, accountable next actions, notes and audit trail.
alter table public.assessments add column if not exists pipeline_stage text not null default 'new';
alter table public.assessments add column if not exists next_action text;
alter table public.assessments add column if not exists next_action_at timestamptz;
alter table public.assessments add column if not exists rejection_reason text;
alter table public.assessments add column if not exists source text;

alter table public.assessments drop constraint if exists assessments_pipeline_stage_check;
alter table public.assessments add constraint assessments_pipeline_stage_check check (pipeline_stage in
  ('new','screening','testing','interview','work_sample','references','offer','hired','declined','reserve'));

create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 2 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists candidate_notes_assessment_idx on public.candidate_notes(assessment_id, created_at desc);
alter table public.candidate_notes enable row level security;
drop policy if exists "branch members read candidate notes" on public.candidate_notes;
create policy "branch members read candidate notes" on public.candidate_notes for select to authenticated
using (public.can_access_assessment(assessment_id));
drop policy if exists "branch members create candidate notes" on public.candidate_notes;
create policy "branch members create candidate notes" on public.candidate_notes for insert to authenticated
with check (public.can_access_assessment(assessment_id) and author_id = auth.uid());
drop policy if exists "authors manage candidate notes" on public.candidate_notes;
create policy "authors manage candidate notes" on public.candidate_notes for delete to authenticated
using (author_id = auth.uid() and public.can_access_assessment(assessment_id));

create or replace function public.audit_assessment_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hiring_audit_log(organization_id,actor_id,entity_type,entity_id,action,metadata)
  values(new.organization_id,auth.uid(),'assessment',new.id::text,'assessment_updated',
    jsonb_build_object('stage_before',old.pipeline_stage,'stage_after',new.pipeline_stage,
      'decision_before',old.final_decision,'decision_after',new.final_decision));
  return new;
end $$;
drop trigger if exists assessment_audit_update on public.assessments;
create trigger assessment_audit_update after update of pipeline_stage,final_decision,next_action,next_action_at
on public.assessments for each row execute function public.audit_assessment_change();

create index if not exists assessments_org_stage_idx on public.assessments(organization_id, branch_id, pipeline_stage, updated_at desc);

alter table public.assessment_invites add column if not exists draft_updated_at timestamptz;
create or replace function public.save_candidate_assignment_draft(raw_token text,response_text text)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if char_length(response_text) > 20000 then return false; end if;
  update public.assessment_invites set candidate_response=response_text,draft_updated_at=now()
  where token_hash=encode(digest(raw_token,'sha256'),'hex') and expires_at>now() and submitted_at is null;
  get diagnostics changed = row_count;
  return changed=1;
end $$;
revoke all on function public.save_candidate_assignment_draft(text,text) from public, authenticated;
grant execute on function public.save_candidate_assignment_draft(text,text) to anon;

-- Добавляет единые поля фильтрации для всех тестов.
-- Выполнить один раз в Supabase SQL Editor.

alter table if exists public.results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

alter table if exists public.tools_results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

alter table if exists public.rezultat_results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

alter table if exists public.logis_results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

alter table if exists public.sails_results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

alter table if exists public.prim_results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

create index if not exists results_branch_audience_idx on public.results(branch_id, applicant_type);
create index if not exists tools_results_branch_audience_idx on public.tools_results(branch_id, applicant_type);
create index if not exists rezultat_results_branch_audience_idx on public.rezultat_results(branch_id, applicant_type);
create index if not exists logis_results_branch_audience_idx on public.logis_results(branch_id, applicant_type);
create index if not exists sails_results_branch_audience_idx on public.sails_results(branch_id, applicant_type);
create index if not exists prim_results_branch_audience_idx on public.prim_results(branch_id, applicant_type);

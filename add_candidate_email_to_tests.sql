-- Добавляет email кандидата во все таблицы результатов.
-- Выполнить один раз в Supabase SQL Editor.

alter table if exists public.results
  add column if not exists candidate_email text;

alter table if exists public.tools_results
  add column if not exists candidate_email text;

alter table if exists public.rezultat_results
  add column if not exists candidate_email text;

alter table if exists public.logis_results
  add column if not exists candidate_email text;

alter table if exists public.sails_results
  add column if not exists candidate_email text;

alter table if exists public.prim_results
  add column if not exists candidate_email text;

create index if not exists results_candidate_email_idx on public.results(lower(candidate_email));
create index if not exists tools_results_candidate_email_idx on public.tools_results(lower(candidate_email));
create index if not exists rezultat_results_candidate_email_idx on public.rezultat_results(lower(candidate_email));
create index if not exists logis_results_candidate_email_idx on public.logis_results(lower(candidate_email));
create index if not exists sails_results_candidate_email_idx on public.sails_results(lower(candidate_email));
create index if not exists prim_results_candidate_email_idx on public.prim_results(lower(candidate_email));

-- Быстрый фикс для вкладки "Анализ" в кабинете руководителя.
-- Выполнить один раз в Supabase SQL Editor.

alter table if exists public.prim_results
  add column if not exists branch_id text,
  add column if not exists applicant_type text default 'candidate';

create index if not exists prim_results_branch_audience_idx
  on public.prim_results(branch_id, applicant_type);

alter table public.prim_results enable row level security;

drop policy if exists "prim_results: read authenticated" on public.prim_results;
drop policy if exists "prim_results: read anon" on public.prim_results;
drop policy if exists "allow select prim" on public.prim_results;

create policy "allow select prim"
  on public.prim_results
  for select
  to anon
  using (true);

drop policy if exists "prim_results: insert anon" on public.prim_results;
drop policy if exists "allow insert prim" on public.prim_results;

create policy "allow insert prim"
  on public.prim_results
  for insert
  to anon
  with check (true);

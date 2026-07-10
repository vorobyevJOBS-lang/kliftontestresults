-- Базовое закрытие публичного чтения персональных данных.
-- Перед применением проверить существующие названия политик в Supabase.

alter table if exists public.rezultat_results enable row level security;
alter table if exists public.sails_results enable row level security;
alter table if exists public.tools_results enable row level security;
alter table if exists public.logis_results enable row level security;
alter table if exists public.prim_results enable row level security;

drop policy if exists "allow_select_rezultat" on public.rezultat_results;
drop policy if exists "allow select sails" on public.sails_results;

-- Кандидаты могут только создать собственную запись. Чтение через anon запрещено.
drop policy if exists "candidate_insert_rezultat" on public.rezultat_results;
create policy "candidate_insert_rezultat" on public.rezultat_results
  for insert to anon with check (true);

drop policy if exists "candidate_insert_sails" on public.sails_results;
create policy "candidate_insert_sails" on public.sails_results
  for insert to anon with check (true);

drop policy if exists "candidate_insert_tools" on public.tools_results;
create policy "candidate_insert_tools" on public.tools_results
  for insert to anon with check (true);

drop policy if exists "candidate_insert_logis" on public.logis_results;
create policy "candidate_insert_logis" on public.logis_results
  for insert to anon with check (true);

-- Временная политика чтения для вошедших пользователей. В production её нужно
-- сузить по organization_id/branch_id из JWT, а не фильтровать только в React.
drop policy if exists "staff_read_rezultat" on public.rezultat_results;
create policy "staff_read_rezultat" on public.rezultat_results
  for select to authenticated using (true);

drop policy if exists "staff_read_sails" on public.sails_results;
create policy "staff_read_sails" on public.sails_results
  for select to authenticated using (true);

drop policy if exists "staff_read_tools" on public.tools_results;
create policy "staff_read_tools" on public.tools_results
  for select to authenticated using (true);

drop policy if exists "staff_read_logis" on public.logis_results;
create policy "staff_read_logis" on public.logis_results
  for select to authenticated using (true);

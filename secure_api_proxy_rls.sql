-- Optional hardening after the Vercel API proxy is configured.
-- Before applying this file, add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.
-- The browser will insert public test results through /api/supabase, and managers will use /api/auth.

alter table if exists public.admins enable row level security;
alter table if exists public.results enable row level security;
alter table if exists public.tools_results enable row level security;
alter table if exists public.rezultat_results enable row level security;
alter table if exists public.logis_results enable row level security;
alter table if exists public.sails_results enable row level security;
alter table if exists public.prim_results enable row level security;
alter table if exists public.candidate_profiles enable row level security;
alter table if exists public.candidate_activity enable row level security;

drop policy if exists "public_insert_results_only" on public.results;
drop policy if exists "public_insert_tools_results_only" on public.tools_results;
drop policy if exists "public_insert_rezultat_results_only" on public.rezultat_results;
drop policy if exists "public_insert_logis_results_only" on public.logis_results;
drop policy if exists "public_insert_sails_results_only" on public.sails_results;
drop policy if exists "public_insert_prim_results_only" on public.prim_results;

create policy "public_insert_results_only" on public.results
  for insert to anon, authenticated with check (true);
create policy "public_insert_tools_results_only" on public.tools_results
  for insert to anon, authenticated with check (true);
create policy "public_insert_rezultat_results_only" on public.rezultat_results
  for insert to anon, authenticated with check (true);
create policy "public_insert_logis_results_only" on public.logis_results
  for insert to anon, authenticated with check (true);
create policy "public_insert_sails_results_only" on public.sails_results
  for insert to anon, authenticated with check (true);
create policy "public_insert_prim_results_only" on public.prim_results
  for insert to anon, authenticated with check (true);

-- 1) Единый ключ кандидата во всех таблицах результатов
alter table if exists public.results add column if not exists candidate_key text;
alter table if exists public.results add column if not exists candidate_email text;

alter table if exists public.tools_results add column if not exists candidate_key text;
alter table if exists public.tools_results add column if not exists candidate_email text;

alter table if exists public.rezultat_results add column if not exists candidate_key text;
alter table if exists public.rezultat_results add column if not exists candidate_email text;
alter table if exists public.rezultat_results add column if not exists candidate_phone text;

alter table if exists public.logis_results add column if not exists candidate_key text;
alter table if exists public.logis_results add column if not exists candidate_email text;

alter table if exists public.sails_results add column if not exists candidate_key text;
alter table if exists public.sails_results add column if not exists candidate_email text;

alter table if exists public.prim_results add column if not exists candidate_key text;
alter table if exists public.prim_results add column if not exists candidate_email text;

create index if not exists results_candidate_key_idx on public.results(candidate_key);
create index if not exists tools_results_candidate_key_idx on public.tools_results(candidate_key);
create index if not exists rezultat_results_candidate_key_idx on public.rezultat_results(candidate_key);
create index if not exists logis_results_candidate_key_idx on public.logis_results(candidate_key);
create index if not exists sails_results_candidate_key_idx on public.sails_results(candidate_key);
create index if not exists prim_results_candidate_key_idx on public.prim_results(candidate_key);

update public.results
set candidate_key = case
  when nullif(trim(candidate_email), '') is not null then 'email:' || lower(trim(candidate_email))
  else 'name:' || lower(regexp_replace(coalesce(candidate_name, 'Без имени'), '\s+', ' ', 'g'))
end
where candidate_key is null;

update public.tools_results
set candidate_key = case
  when nullif(trim(candidate_email), '') is not null then 'email:' || lower(trim(candidate_email))
  else 'name:' || lower(regexp_replace(coalesce(candidate_name, 'Без имени'), '\s+', ' ', 'g'))
end
where candidate_key is null;

update public.rezultat_results
set candidate_key = case
  when nullif(trim(candidate_email), '') is not null then 'email:' || lower(trim(candidate_email))
  when nullif(regexp_replace(coalesce(candidate_phone, ''), '\D', '', 'g'), '') is not null then 'phone:' || regexp_replace(candidate_phone, '\D', '', 'g')
  else 'name:' || lower(regexp_replace(coalesce(candidate_name, 'Без имени'), '\s+', ' ', 'g'))
end
where candidate_key is null;

update public.logis_results
set candidate_key = case
  when nullif(trim(candidate_email), '') is not null then 'email:' || lower(trim(candidate_email))
  else 'name:' || lower(regexp_replace(coalesce(name, 'Без имени'), '\s+', ' ', 'g'))
end
where candidate_key is null;

update public.sails_results
set candidate_key = case
  when nullif(trim(candidate_email), '') is not null then 'email:' || lower(trim(candidate_email))
  else 'name:' || lower(regexp_replace(coalesce(name, 'Без имени'), '\s+', ' ', 'g'))
end
where candidate_key is null;

update public.prim_results
set candidate_key = case
  when nullif(trim(candidate_email), '') is not null then 'email:' || lower(trim(candidate_email))
  else 'name:' || lower(regexp_replace(coalesce(candidate_name, 'Без имени'), '\s+', ' ', 'g'))
end
where candidate_key is null;

-- 2) Рабочая карточка человека: статус, заметки HR/руководителя
create table if not exists public.candidate_profiles (
  candidate_key text primary key,
  candidate_name text,
  candidate_email text,
  candidate_phone text,
  branch_id text,
  status text not null default 'testing',
  manager_comment text,
  hr_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_profiles_branch_idx on public.candidate_profiles(branch_id);
create index if not exists candidate_profiles_status_idx on public.candidate_profiles(status);
create index if not exists candidate_profiles_email_idx on public.candidate_profiles(lower(candidate_email));

alter table public.candidate_profiles enable row level security;

drop policy if exists "candidate_profiles_select" on public.candidate_profiles;
drop policy if exists "candidate_profiles_insert" on public.candidate_profiles;
drop policy if exists "candidate_profiles_update" on public.candidate_profiles;

create policy "candidate_profiles_select"
on public.candidate_profiles for select
to anon
using (true);

create policy "candidate_profiles_insert"
on public.candidate_profiles for insert
to anon
with check (true);

create policy "candidate_profiles_update"
on public.candidate_profiles for update
to anon
using (true)
with check (true);

-- 3) Переходный безопасный вход: приложение теперь умеет проверять password_hash.
-- После проверки доступа можно будет убрать plaintext password отдельным шагом.
create extension if not exists pgcrypto;
alter table if exists public.admins add column if not exists password_hash text;
update public.admins
set password_hash = encode(digest(password, 'sha256'), 'hex')
where password_hash is null
  and password is not null;

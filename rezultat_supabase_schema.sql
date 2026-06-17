-- Таблица результатов теста Резалт (HRScanner)
-- Запустите в SQL Editor вашего Supabase проекта

create table if not exists rezultat_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- Данные анкеты
  candidate_name text not null,
  candidate_age int,
  candidate_phone text,
  candidate_city text,
  candidate_gender text,          -- 'Мужчина' | 'Женщина'
  previous_test boolean default false,

  -- Ответы на вопросы (массив объектов, по одному на каждое место работы)
  -- Каждый объект: { [questionId]: { choice?, text?, texts?, comment? } }
  jobs jsonb not null default '[]',

  -- Мета
  answers_count int default 19,
  completed boolean default true,
  branch_id text
);

-- Разрешаем вставку без авторизации (для кандидатов)
alter table rezultat_results enable row level security;

create policy "allow_insert_rezultat" on rezultat_results
  for insert with check (true);

create policy "allow_select_rezultat" on rezultat_results
  for select using (true);

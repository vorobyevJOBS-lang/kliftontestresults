-- SQL для создания таблицы результатов теста Тулс в Supabase
-- Выполните этот запрос в разделе "SQL Editor" на сайте supabase.com

create table if not exists tools_results (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),

  -- Кандидат
  candidate_name  text not null,
  candidate_age   int,

  -- Баллы по 10 показателям (-100..+100)
  -- Хранятся как JSONB: {"Внимательность": 68, "Позитивность": -12, ...}
  scores          jsonb not null default '{}',

  -- Метаданные теста
  answers_count   int,
  total_questions int default 200,

  -- Синдромы (массив строк)
  syndromes       text[] default '{}',

  -- Прогресс и время
  answered_count  int,          -- сколько вопросов ответил (из 200)
  time_spent      int,          -- секунд потрачено

  -- Опционально: привязка к филиалу
  branch_id       text,
  applicant_type  text default 'candidate'  -- candidate | employee
);

-- Включите Row Level Security (опционально, если хотите защиту)
-- alter table tools_results enable row level security;

-- Индекс для быстрой сортировки по дате
create index if not exists tools_results_created_at_idx on tools_results(created_at desc);

-- Если таблица уже существует — добавьте новые колонки:
alter table tools_results add column if not exists answered_count int;
alter table tools_results add column if not exists time_spent     int;

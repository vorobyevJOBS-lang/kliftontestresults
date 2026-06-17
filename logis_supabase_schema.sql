-- Таблица результатов теста Логис (IQ)
-- Выполнить в Supabase → SQL Editor

create table if not exists logis_results (
  id            bigserial primary key,
  name          text        not null,               -- имя кандидата
  score         integer     not null,               -- 80 + correct_answers (макс 160)
  correct_answers integer   not null,               -- кол-во правильных ответов (макс 80)
  answers       jsonb,                              -- JSON-объект { "1": 3, "2": 1, ... }
  completed_at  timestamptz not null default now()  -- время завершения теста
);

-- Включить Row Level Security (опционально, только если нужна защита)
-- alter table logis_results enable row level security;

-- Разрешить вставку без авторизации (публичный тест)
create policy "allow insert logis" on logis_results
  for insert with check (true);

-- Разрешить чтение только авторизованным (опционально)
-- create policy "allow select logis" on logis_results
--   for select using (auth.role() = 'authenticated');

-- Индекс для быстрой сортировки по дате
create index if not exists logis_results_completed_at_idx
  on logis_results (completed_at desc);

-- ─────────────────────────────────────────────────────────────
-- ПЕРВИЧНЫЙ АНАЛИЗ — схема таблицы prim_results
-- Выполнить в Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prim_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  candidate_name  TEXT NOT NULL,
  candidate_age   INTEGER,
  scores          JSONB,          -- { "Энергия": 60, "Ответственность": 40, ... }
  answers_count   INTEGER,
  total_questions INTEGER DEFAULT 160,
  time_spent      INTEGER,        -- секунды
  maybe_count     INTEGER
);

-- Индекс для сортировки по дате
CREATE INDEX IF NOT EXISTS prim_results_created_at_idx ON public.prim_results (created_at DESC);

-- Включить Row Level Security
ALTER TABLE public.prim_results ENABLE ROW LEVEL SECURITY;

-- Политика: чтение — для админки проекта.
-- В приложении руководители входят через таблицу admins, а не через Supabase Auth,
-- поэтому запросы к результатам идут под ролью anon.
CREATE POLICY "prim_results: read anon"
  ON public.prim_results FOR SELECT
  TO anon
  USING (true);

-- Политика: запись — для всех (кандидаты не авторизованы)
CREATE POLICY "prim_results: insert anon"
  ON public.prim_results FOR INSERT
  TO anon
  WITH CHECK (true);

-- Политика: удаление — только авторизованные (суперадмин)
CREATE POLICY "prim_results: delete authenticated"
  ON public.prim_results FOR DELETE
  TO authenticated
  USING (true);

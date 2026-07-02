-- Целевая должность кандидата и обратная связь после найма
alter table if exists public.results add column if not exists target_position_id text;
alter table if exists public.results add column if not exists target_position_name text;

update public.results
set
  target_position_id = coalesce(target_position_id, position_id),
  target_position_name = coalesce(target_position_name, position_name)
where target_position_id is null
   or target_position_name is null;

alter table if exists public.candidate_profiles add column if not exists target_position_id text;
alter table if exists public.candidate_profiles add column if not exists target_position_name text;
alter table if exists public.candidate_profiles add column if not exists hired_feedback text;
alter table if exists public.candidate_profiles add column if not exists hired_feedback_date timestamptz;

create index if not exists results_target_position_idx on public.results(target_position_id);
create index if not exists candidate_profiles_target_position_idx on public.candidate_profiles(target_position_id);
create index if not exists candidate_profiles_hired_feedback_date_idx on public.candidate_profiles(hired_feedback_date);

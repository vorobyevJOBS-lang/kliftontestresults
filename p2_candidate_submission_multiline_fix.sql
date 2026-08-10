-- EvidenceHire P2: accept a complete multi-line plan as one response section.
-- This migration changes only validation code. It does not update candidate rows.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function app_private.candidate_response_is_valid(
  response_text text,
  candidate_modules text[],
  require_complete boolean
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $function$
declare
  payload jsonb;
  answers jsonb;
  answer_count integer;
  work_sample text;
  approach text;
  verification text;
begin
  if response_text is null or char_length(response_text) > 20000 then
    return false;
  end if;
  begin
    payload := response_text::jsonb;
  exception when others then
    return false;
  end;
  if jsonb_typeof(payload) is distinct from 'object'
     or payload ->> 'schema' is distinct from 'evidencehire-candidate-v1'
     or jsonb_typeof(payload -> 'screening') is distinct from 'object'
     or jsonb_typeof(payload -> 'workSample') is distinct from 'string' then
    return false;
  end if;
  work_sample := payload ->> 'workSample';
  if require_complete then
    if position('[ПЛАН ИЛИ РЕШЕНИЕ]' || E'\n' in work_sample) <> 1
       or position(E'\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n' in work_sample) = 0
       or position(E'\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\n' in work_sample) = 0
       or position(E'\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n' in work_sample)
          >= position(E'\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\n' in work_sample) then
      return false;
    end if;
    approach := split_part(
      split_part(work_sample, E'\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n', 1),
      '[ПЛАН ИЛИ РЕШЕНИЕ]' || E'\n',
      2
    );
    verification := split_part(work_sample, E'\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\n', 2);
    if char_length(btrim(approach)) < 20
       or char_length(btrim(verification)) < 1 then
      return false;
    end if;
  end if;
  if 'work_preferences_fc' = any(coalesce(candidate_modules, '{}')) then
    if jsonb_typeof(payload -> 'rolePreferences') is distinct from 'object'
       or payload #>> '{rolePreferences,schema}' is distinct from 'work-preferences-fc-legacy-166-v1'
       or payload #>> '{rolePreferences,itemBankSha256}' is distinct from '33c2f9e6f716b90029912db46899b6c02de82ea43f5d9a5ced9119986ec6ea1b'
       or jsonb_typeof(payload #> '{rolePreferences,answers}') is distinct from 'array' then
      return false;
    end if;
    answers := payload #> '{rolePreferences,answers}';
    answer_count := jsonb_array_length(answers);
    if (require_complete and answer_count <> 166)
       or (not require_complete and answer_count > 166)
       or exists (
         select 1
         from jsonb_array_elements(answers) as item(value)
         where jsonb_typeof(item.value) is distinct from 'string'
            or item.value #>> '{}' not in ('A', 'B')
       ) then
      return false;
    end if;
  end if;
  return true;
end
$function$;

revoke all on function app_private.candidate_response_is_valid(text, text[], boolean)
  from public, anon, authenticated, service_role;

do $regression_test$
declare
  multiline_response text := jsonb_build_object(
    'schema', 'evidencehire-candidate-v1',
    'screening', '{}'::jsonb,
    'workSample', E'[ПЛАН ИЛИ РЕШЕНИЕ]\n1234567890123456789\nПродолжение плана\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\nПроверю результат'
  )::text;
  short_response text := jsonb_build_object(
    'schema', 'evidencehire-candidate-v1',
    'screening', '{}'::jsonb,
    'workSample', E'[ПЛАН ИЛИ РЕШЕНИЕ]\n1234567890123456789\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\nПроверю'
  )::text;
  empty_verification_response text := jsonb_build_object(
    'schema', 'evidencehire-candidate-v1',
    'screening', '{}'::jsonb,
    'workSample', E'[ПЛАН ИЛИ РЕШЕНИЕ]\nЭтот план точно длиннее двадцати символов\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\n'
  )::text;
  preferences_response text := jsonb_build_object(
    'schema', 'evidencehire-candidate-v1',
    'screening', '{}'::jsonb,
    'rolePreferences', jsonb_build_object(
      'schema', 'work-preferences-fc-legacy-166-v1',
      'itemBankSha256', '33c2f9e6f716b90029912db46899b6c02de82ea43f5d9a5ced9119986ec6ea1b',
      'answers', to_jsonb(array_fill('A'::text, array[166]))
    ),
    'workSample', E'[ПЛАН ИЛИ РЕШЕНИЕ]\n1234567890123456789\nПродолжение плана\n\n[КЛЮЧЕВЫЕ ДЕТАЛИ]\n\n\n[ПРОВЕРКА РЕЗУЛЬТАТА]\nПроверю результат'
  )::text;
begin
  if not app_private.candidate_response_is_valid(multiline_response, '{}'::text[], true) then
    raise exception 'EvidenceHire P2 aborted: complete multi-line plan was rejected';
  end if;
  if app_private.candidate_response_is_valid(short_response, '{}'::text[], true) then
    raise exception 'EvidenceHire P2 aborted: short full plan was accepted';
  end if;
  if app_private.candidate_response_is_valid(empty_verification_response, '{}'::text[], true) then
    raise exception 'EvidenceHire P2 aborted: empty verification was accepted';
  end if;
  if not app_private.candidate_response_is_valid(preferences_response, array['work_preferences_fc']::text[], true) then
    raise exception 'EvidenceHire P2 aborted: complete 166-answer response was rejected';
  end if;
end
$regression_test$;

commit;

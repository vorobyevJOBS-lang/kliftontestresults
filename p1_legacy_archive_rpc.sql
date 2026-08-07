-- Branch-scoped access to the immutable legacy archive without a Vercel
-- service-role secret. Apply after p0_hiring_security_and_archive.sql.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '2min';

create or replace function public.list_legacy_result_index()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_org uuid;
  caller_role text;
  allowed_branches text[];
  legacy_branches text[];
  table_name text;
  type_name text;
  label_name text;
  date_column text;
  source_row jsonb;
  items jsonb := '[]'::jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select m.organization_id, m.role::text
    into caller_org, caller_role
  from public.organization_members m
  where m.user_id = caller_id
  limit 1;
  if caller_org is null then
    raise exception 'Membership required' using errcode = '42501';
  end if;

  if caller_role <> 'owner' then
    select coalesce(array_agg(distinct branch_id), '{}')
      into allowed_branches
    from (
      select m.branch_id
      from public.organization_members m
      where m.organization_id = caller_org and m.user_id = caller_id and m.branch_id is not null
      union all
      select g.branch_id
      from public.organization_member_branches g
      where g.organization_id = caller_org and g.user_id = caller_id
    ) branches;
    legacy_branches := allowed_branches;
    if 'jobs_design' = any(allowed_branches) then
      legacy_branches := array_append(legacy_branches, 'jobs_main');
    end if;
    if cardinality(legacy_branches) = 0 then
      raise exception 'Branch access required' using errcode = '42501';
    end if;
  end if;

  for table_name, type_name, label_name, date_column in
    select * from (values
      ('results', 'clifton', 'Клифтон', 'created_at'),
      ('tools_results', 'tools', 'Профиль', 'created_at'),
      ('rezultat_results', 'rezultat', 'Опыт', 'created_at'),
      ('logis_results', 'logis', 'Логика', 'completed_at'),
      ('sails_results', 'sails', 'Продажник', 'completed_at'),
      ('prim_results', 'prim', 'Первичный анализ', 'created_at')
    ) catalog(table_name, type_name, label_name, date_column)
  loop
    if caller_role = 'owner' then
      for source_row in execute format(
        'select to_jsonb(source) from public.%I source order by %I desc nulls last limit 1000',
        table_name, date_column
      ) loop
        items := items || jsonb_build_array(jsonb_build_object(
          'id', table_name || ':' || coalesce(source_row ->> 'id', ''),
          'sourceId', source_row ->> 'id',
          'table', table_name,
          'type', type_name,
          'label', label_name,
          'candidateName', coalesce(source_row ->> 'candidate_name', source_row ->> 'name', 'Без имени'),
          'email', coalesce(source_row ->> 'candidate_email', source_row ->> 'email', ''),
          'phone', coalesce(source_row ->> 'candidate_phone', source_row ->> 'phone', ''),
          'branchId', coalesce(source_row ->> 'branch_id', ''),
          'candidateKey', coalesce(source_row ->> 'candidate_key', ''),
          'createdAt', coalesce(source_row ->> date_column, source_row ->> 'created_at', source_row ->> 'completed_at'),
          'summary', jsonb_strip_nulls(jsonb_build_object(
            'position_name', source_row -> 'position_name',
            'recommended_position', source_row -> 'recommended_position',
            'total_score', source_row -> 'total_score',
            'score', source_row -> 'score',
            'level', source_row -> 'level'
          ))
        ));
      end loop;
    else
      for source_row in execute format(
        'select to_jsonb(source) from public.%I source where branch_id = any($1) order by %I desc nulls last limit 1000',
        table_name, date_column
      ) using legacy_branches loop
        items := items || jsonb_build_array(jsonb_build_object(
          'id', table_name || ':' || coalesce(source_row ->> 'id', ''),
          'sourceId', source_row ->> 'id',
          'table', table_name,
          'type', type_name,
          'label', label_name,
          'candidateName', coalesce(source_row ->> 'candidate_name', source_row ->> 'name', 'Без имени'),
          'email', coalesce(source_row ->> 'candidate_email', source_row ->> 'email', ''),
          'phone', coalesce(source_row ->> 'candidate_phone', source_row ->> 'phone', ''),
          'branchId', coalesce(source_row ->> 'branch_id', ''),
          'candidateKey', coalesce(source_row ->> 'candidate_key', ''),
          'createdAt', coalesce(source_row ->> date_column, source_row ->> 'created_at', source_row ->> 'completed_at'),
          'summary', jsonb_strip_nulls(jsonb_build_object(
            'position_name', source_row -> 'position_name',
            'recommended_position', source_row -> 'recommended_position',
            'total_score', source_row -> 'total_score',
            'score', source_row -> 'score',
            'level', source_row -> 'level'
          ))
        ));
      end loop;
    end if;
  end loop;
  return jsonb_build_object('organizationId', caller_org, 'items', items, 'warnings', '[]'::jsonb);
end
$function$;

create or replace function public.get_legacy_result_detail(
  target_table text,
  target_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_org uuid;
  caller_role text;
  allowed_branches text[];
  legacy_branches text[];
  result_row jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if target_table not in ('results','tools_results','rezultat_results','logis_results','sails_results','prim_results')
     or target_id is null or char_length(target_id) not between 1 and 80 then
    raise exception 'Invalid legacy result reference' using errcode = '22023';
  end if;
  select m.organization_id, m.role::text
    into caller_org, caller_role
  from public.organization_members m
  where m.user_id = caller_id
  limit 1;
  if caller_org is null then
    raise exception 'Membership required' using errcode = '42501';
  end if;

  if caller_role = 'owner' then
    execute format('select to_jsonb(source) from public.%I source where id::text = $1 limit 1', target_table)
      into result_row using target_id;
  else
    select coalesce(array_agg(distinct branch_id), '{}')
      into allowed_branches
    from (
      select m.branch_id
      from public.organization_members m
      where m.organization_id = caller_org and m.user_id = caller_id and m.branch_id is not null
      union all
      select g.branch_id
      from public.organization_member_branches g
      where g.organization_id = caller_org and g.user_id = caller_id
    ) branches;
    legacy_branches := allowed_branches;
    if 'jobs_design' = any(allowed_branches) then
      legacy_branches := array_append(legacy_branches, 'jobs_main');
    end if;
    execute format(
      'select to_jsonb(source) from public.%I source where id::text = $1 and branch_id = any($2) limit 1',
      target_table
    ) into result_row using target_id, legacy_branches;
  end if;
  if result_row is null then
    raise exception 'Legacy result not found' using errcode = 'P0002';
  end if;
  return result_row;
end
$function$;

revoke all on function public.list_legacy_result_index() from public, anon, authenticated, service_role;
revoke all on function public.get_legacy_result_detail(text, text) from public, anon, authenticated, service_role;
grant execute on function public.list_legacy_result_index() to authenticated;
grant execute on function public.get_legacy_result_detail(text, text) to authenticated;

commit;
